const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

document.getElementById('processButton').addEventListener('click', async () => {
  const videoFile = document.getElementById('videoInput').files[0];
  if (!videoFile) {
    alert('Please upload a video!');
    return;
  }
  await processVideo(videoFile);
});

async function processVideo(videoFile) {
  const button = document.getElementById('processButton');
  button.innerText = 'Processing...';
  button.disabled = true;
  updateStatus('Loading video...', 10);
  logMessage('Starting video processing...');

  try {
    // Load FFmpeg
    if (!ffmpeg.isLoaded()) {
      updateStatus('Loading FFmpeg...', 20);
      logMessage('Loading FFmpeg...');
      await ffmpeg.load();
      logMessage('FFmpeg loaded successfully.');
    }

    // Write the uploaded file to FFmpeg's file system
    const videoName = 'input.mp4';
    updateStatus('Processing video...', 30);
    logMessage('Writing video to FFmpeg file system...');
    ffmpeg.FS('writeFile', videoName, await fetchFile(videoFile));
    logMessage('Video written successfully.');

    // Step 1: Get video duration
    updateStatus('Analyzing video duration...', 40);
    logMessage('Analyzing video duration...');
    const duration = await getVideoDuration(videoName);
    logMessage(`Video duration: ${duration} seconds.`);

    // Step 2: Generate a clip of 10-30 seconds
    const clipDuration = Math.min(30, Math.max(10, duration)); // Ensure clip is 10-30 seconds
    const startTime = Math.random() * (duration - clipDuration); // Random start time
    const shortName = 'short_1.mp4';

    // Trim and resize the video
    updateStatus('Creating short clip...', 60);
    logMessage('Trimming and resizing video...');

    // Add FFmpeg progress listener
    ffmpeg.setLogger(({ type, message }) => {
      if (type === 'ffout') {
        const frameMatch = message.match(/frame=\s*(\d+)/);
        if (frameMatch) {
          const framesRendered = parseInt(frameMatch[1]);
          updateFrameCounter(framesRendered);
        }
      }
    });

    await ffmpeg.run(
      '-i', videoName,
      '-vf', 'scale=1080:1920',
      '-ss', startTime.toString(),
      '-t', clipDuration.toString(),
      shortName
    );
    logMessage('Clip created successfully.');

    // Step 3: Generate download link
    const data = ffmpeg.FS('readFile', shortName);
    const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(videoBlob);

    // Display the short clip
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = `
      <video src="${videoUrl}" controls></video>
      <a href="${videoUrl}" download="${shortName}">Download Short</a>
    `;
    outputDiv.style.display = 'block';

    updateStatus('Processing complete!', 100);
    logMessage('Video processing completed successfully.');
  } catch (error) {
    console.error('Error processing video:', error);
    updateStatus('An error occurred while processing the video.', 0);
    logMessage(`Error: ${error.message}`);
    alert('An error occurred while processing the video.');
  } finally {
    // Reset button
    button.innerText = 'Process Video';
    button.disabled = false;
  }
}

async function getVideoDuration(videoName) {
  return new Promise((resolve, reject) => {
    const logs = [];
    const originalLog = console.log;
    console.log = (message) => {
      logs.push(message);
      originalLog(message);
    };

    ffmpeg.run('-i', videoName)
      .then(() => {
        console.log = originalLog; // Restore original console.log
        const logText = logs.join('\n');
        const durationMatch = logText.match(/Duration: (\d+):(\d+):(\d+)/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          resolve(hours * 3600 + minutes * 60 + seconds);
        } else {
          reject(new Error('Could not determine video duration.'));
        }
      })
      .catch((error) => {
        console.log = originalLog; // Restore original console.log
        reject(error);
      });
  });
}

function updateStatus(message, progress) {
  const statusDiv = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  statusDiv.innerText = message;
  progressBar.style.width = `${progress}%`;
}

function updateFrameCounter(frames) {
  const frameCounter = document.getElementById('frameCounter');
  frameCounter.innerText = `Frames rendered: ${frames}`;
}

function logMessage(message) {
  const logDiv = document.getElementById('log');
  const logEntry = document.createElement('div');
  logEntry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
  logDiv.appendChild(logEntry);
  logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll to the latest log
}
