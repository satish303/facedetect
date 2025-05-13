import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import './App.css'
function App() {
  // State and refs
  const [questions] = useState([
    { id: 1, type: 'mcq', text: 'What is 2 + 2?', options: ['3', '4', '5'] },
    { id: 2, type: 'text', text: 'Briefly explain gravity:' }
  ]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes exam timer
  const [alertMessage, setAlertMessage] = useState("");
  const webcamRef = useRef(null);
  const logsRef = useRef([]);
const [examStarted, setExamStarted] = useState(false);
const [initFaceCheckDone, setInitFaceCheckDone] = useState(false);
const [movementWarnings, setMovementWarnings] = useState(0);
const maxWarnings = 5; // You can make this configurable
const initCheckRef = useRef(false);
const examStartedRef = useRef(false);
const movementWarningsRef = useRef(0);
const [examTerminated, setExamTerminated] = useState(false);

console.log()
  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);
const setInitFaceCheck = (val) => {
  setInitFaceCheckDone(val);
  initCheckRef.current = val;
};

const setExamStatus = (val) => {
  setExamStarted(val);
  examStartedRef.current = val;
};

const setWarningsCount = (val) => {
  setMovementWarnings(val);
  movementWarningsRef.current = val;
};

  // Face-api model loading and monitoring effect
  useEffect(() => {
    let intervalId;
    const loadModelsAndStart = async () => {
      // Load models from public/models
   await Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models")
]);
console.log("✅ Models loaded");
      // Start periodic face detection
      intervalId = setInterval(async () => {
        if (
          !webcamRef.current ||
          !webcamRef.current.video ||
          webcamRef.current.video.readyState !== 4
        ) {
          return;
        }
        const video = webcamRef.current.video;
       const detections = await faceapi
  .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,        // 160, 224, 320, 416, 512
    scoreThreshold: 0.4    // Lower = more sensitive
  }))
  .withFaceLandmarks();
        handleDetections(detections);
      }, 500);
    };
    loadModelsAndStart();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);


  // Heuristic to check if the user is looking away (using face landmarks)
  const isLookingAway = landmarks => {
    if (!landmarks) return false;
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    // Horizontal distance between leftmost point of left eye and rightmost point of right eye
    const eyeSpan = rightEye[rightEye.length - 1].x - leftEye[0].x;
    const noseX = nose[3].x; // tip of nose
    const centerX = leftEye[0].x + eyeSpan / 2;
    return Math.abs(noseX - centerX) > eyeSpan * 0.3;
  };

  // Log a violation event with timestamp and snapshot
  const logViolation = type => {
    const timestamp = new Date().toISOString();
    let snapshot = null;
    if (webcamRef.current) {
      snapshot = webcamRef.current.getScreenshot();
    }
    logsRef.current.push({ time: timestamp, type, image: snapshot });
    try {
      localStorage.setItem("examLogs", JSON.stringify(logsRef.current));
    } catch (e) {
      console.error("Failed to save logs to localStorage", e);
    }
  };

  // Handle face-api detections
const handleDetections = (detections) => {
  if (!initCheckRef.current) {
    if (detections.length === 1) {
      setInitFaceCheck(true);
      setExamStatus(true);
      setAlertMessage("");
    } else {
      setAlertMessage("Please ensure only your face is visible in the camera to begin the exam.");
    }
    return;
  }

  if (!examStartedRef.current) return;

  if (detections.length === 0) {
    setAlertMessage("No face detected");
    logViolation("no_face");
    return;
  }

  if (detections.length > 1) {
    setAlertMessage("Unauthorized person detected in the background. The exam has been terminated.");
    logViolation("multiple_faces_terminate");
    setExamStatus(false);
    setInitFaceCheck(false);
    setTimeLeft(0);
  setExamTerminated(true); // ⬅️ Add this
    return;
  }

  const landmarks = detections[0].landmarks;
  if (isLookingAway(landmarks)) {
    const newWarnings = movementWarningsRef.current + 1;
    setWarningsCount(newWarnings);
    setAlertMessage("You are not allowed to move your face during the exam.");
    logViolation("looking_away");
console.log(newWarnings,"newWarnings")
    if (newWarnings >= maxWarnings) {
      setAlertMessage("You have exceeded the allowed face movement limit. The exam is now terminated.");
      setExamStatus(false);
      setInitFaceCheck(false);
      setTimeLeft(0);
  setExamTerminated(true); // ⬅️ Add this
    }
  } else {
    if (alertMessage === "You are not allowed to move your face during the exam.") {
      setAlertMessage("");
    }
  }
};




  const handleSubmit = () => {
    // Submission logic (could send answers to server or grade)
    console.log("Exam submitted. Answers:", answers);
    // (For demo, just log answers. In real app, you'd handle accordingly.)
  };

 return (
  <div className="exam-app">
    <div className="exam-content">
      <h1>Online Exam</h1>
      <div className="timer">Time Remaining: {timeLeft}s</div>
        {examTerminated && (
        <div className="alert error-block">
          {alertMessage || "The exam has been terminated. You cannot proceed further."}
        </div>
      )}
{!initFaceCheckDone && (
  <div className="waiting-message">
    <p>Please ensure only your face is visible in the camera to begin the exam.</p>
  </div>
)}
     {!examTerminated && examStarted && (
  <>
    {questions.map(q => (
      <div key={q.id} className="question">
        <p>{q.text}</p>
        {q.type === 'mcq' ? (
          q.options.map(opt => (
            <label key={opt}>
              <input
                type="radio"
                name={`q${q.id}`}
                value={opt}
                disabled={timeLeft === 0}
                onChange={() =>
                  setAnswers(prev => ({ ...prev, [q.id]: opt }))
                }
              />
              {opt}
            </label>
          ))
        ) : (
          <textarea
            rows="3"
            disabled={timeLeft === 0}
            onChange={e =>
              setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))
            }
          />
        )}
      </div>
    ))}

    <button onClick={handleSubmit} disabled={timeLeft === 0}>
      Submit Exam
    </button>
  </>
)}
  {alertMessage && !examTerminated && (
        <div className="alert">{alertMessage}</div>
      )}  
        </div>

    <div className="webcam-wrapper">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 320,
          height: 240,
          facingMode: "user",
        }}
      />
    </div>
  </div>
);

}

export default App;
