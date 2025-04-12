/**
 * Hand Gesture Musical Instrument
 * 
 * Controls:
 * - Left hand: Plays harmony/chords based on vertical position
 * - Right hand: Plays melody notes based on vertical position
 * - Pinch gesture (both hands): Controls volume
 * - UI controls: Select scale and instrument sound
 */

// Initialize the application when the window loads
window.addEventListener('load', init);

// Global variables
let scene, camera, renderer;
let particles;
let hands;
let handDetected = false;
let isLeftHandPresent = false;
let isRightHandPresent = false;
let leftHandLandmarks = null;
let rightHandLandmarks = null;

// Debugging variables for tracking changes
let lastRightHandY = 0;
let lastLeftHandY = 0;
let lastMelodyNote = null;
let lastChord = null;

// Audio variables
let melodySynth, harmonySynth, filter, reverb;
let leftHandIsPlaying = false;
let rightHandIsPlaying = false;
let currentMelodyNote = null;
let currentChord = null;
let leftHandVolume = 0.5;
let rightHandVolume = 0.5;

// Music theory variables
let selectedScale = 'major';
let selectedRoot = 'C';
let octave = 4;
let selectedSound = 'pad';

// Scales definition
const scales = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  pentatonic: [0, 2, 4, 7, 9, 12],
  majorBlues: [0, 3, 5, 6, 7, 10, 12],
  minorBlues: [0, 3, 5, 6, 7, 10, 12],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
};

// Notes and chord types
const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const chordTypes = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  minor7: [0, 3, 7, 10],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus4: [0, 5, 7],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11]
};
 
// Update sound presets with optimized settings to reduce distortion
const soundPresets = {
  synth: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.8 }
  },
  bell: {
    oscillator: { type: 'sine4' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1.5 }
  },
  synth: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.8 }
  },
  pad: {
    oscillator: { type: 'sine8' },
    envelope: { attack: 0.4, decay: 0.7, sustain: 0.6, release: 2 }
  },
  pluck: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 }
  },
  piano: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0.7, release: 0.3 }
    }
};

// Hand tracking
let canvasCtx, canvasElement, videoElement;

// Gesture variables
const MIN_PINCH_DIST = 0.01;
const MAX_PINCH_DIST = 0.1;

// Current active UI element
let activeUIElement = null;

// Flag to track if audio has been started
let audioStarted = false;

// Initialization function
function init() {
  // Setup THREE.js scene
  setupThreeJS();
  
  // Create UI
  createUI();
  
  // Create note position markers
  createNoteMarkers();
  
  // Create visual keyboard
  createVisualKeyboard();
  
  // Get webcam elements for hand tracking
  setupWebcamElements();
  
  // Start hand tracking
  setupHandTracking();
  
  // Start animation loop
  animate();
  
  // Display initial instructions
  updateInstructions();
  
  // Add prominent start button
  addStartAudioButton();
}

// Add prominent start audio button
function addStartAudioButton() {
  const startButton = document.createElement('button');
  startButton.textContent = 'Start Audio';
  startButton.style.position = 'fixed';
  startButton.style.top = '50%';
  startButton.style.left = '50%';
  startButton.style.transform = 'translate(-50%, -50%)';
  startButton.style.zIndex = '1000';
  startButton.style.padding = '20px';
  startButton.style.fontSize = '24px';
  startButton.style.backgroundColor = '#4CAF50';
  startButton.style.color = 'white';
  startButton.style.border = 'none';
  startButton.style.borderRadius = '10px';
  startButton.style.cursor = 'pointer';
  startButton.style.fontFamily = 'Arial, sans-serif';
  startButton.style.boxShadow = '0 5px 8px rgba(0, 0, 0, 0.6)';

  document.body.appendChild(startButton);

  startButton.addEventListener('click', function() {
    if (Tone.context.state !== 'running') {
      Tone.start();
      audioStarted = true;
      document.body.removeChild(startButton);
      showMessage('Move your hands to play!');
      // Moved audio setup here:
      setupAudio();
    }
  });
}

// Setup THREE.js scene, camera and renderer
function setupThreeJS() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000a14);
  
  // Create camera
  camera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, 0.1, 1000
  );
  camera.position.z = 200;
  
  // Create renderer with motion blur effects
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    preserveDrawingBuffer: true // Needed for trails effect
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.autoClearColor = false; // Don't clear color buffer to create trails
  
  // Add renderer to DOM
  const container = document.getElementById('container');
  if (container) {
    container.appendChild(renderer.domElement);
  } else {
    console.error("Container element not found!");
    return;
  }
  
  // Add event listener for window resize
  window.addEventListener('resize', onWindowResize);
  
  // Create particle system for visualization
  createParticleSystem();
}

// Setup audio with Tone.js - with improved audio quality settings
function setupAudio() {
  // Set overall audio quality parameters
  Tone.context.latencyHint = 'balanced';
  Tone.context.lookAhead = 0.2;  // Increase lookAhead for better scheduling
  
  // Create a limiter to prevent audio clipping
  const limiter = new Tone.Limiter(-3).toDestination();
  
  // Improve overall sound with slightly deeper reverb and a gentle compressor
  const compressor = new Tone.Compressor(-12, 3).toDestination();
  
  reverb = new Tone.Reverb({
    decay: 2.0,
    wet: 0.3,
    preDelay: 0.07,
  });
  limiter.connect(reverb);  

  filter = new Tone.Filter({
    type: "lowpass",
    frequency: 8000,   // Increased from 2000 for more clarity
    Q: 0.5,            // Reduced from 1 for smoother filtering
    rolloff: -12       // Gentler rolloff for more natural sound
  });
  
  // Connect filter after it's defined
  filter.connect(reverb);
  reverb.connect(compressor);
  
  // Add effects with optimal settings
  
  // Create synths with optimized settings
  melodySynth = new Tone.Synth({
    oscillator: {
      type: soundPresets[selectedSound].oscillator.type,
      modulationType: "sine",
      harmonicity: 1
    },
    envelope: {
      attack: soundPresets[selectedSound].envelope.attack,
      decay: soundPresets[selectedSound].envelope.decay,
      sustain: soundPresets[selectedSound].envelope.sustain,
      release: soundPresets[selectedSound].envelope.release,
    },
    portamento: 0.02   // Small portamento for smoother transitions
  });
  
  harmonySynth = new Tone.PolySynth({
    maxPolyphony: 6,   // Limit max polyphony to prevent overloading
    voice: Tone.Synth,
    options: {
      oscillator: {
        type: soundPresets[selectedSound].oscillator.type,
        modulationType: "sine",
        harmonicity: 1
      },
      envelope: {
        attack: soundPresets[selectedSound].envelope.attack * 1.2,  // Slightly slower attack for chords
        decay: soundPresets[selectedSound].envelope.decay,
        sustain: soundPresets[selectedSound].envelope.sustain,
        release: soundPresets[selectedSound].envelope.release * 1.5,  // Longer release for smoother chord transitions
      },
      portamento: 0.02  // Small portamento for smoother transitions
    }
  });
  
  // Connect in proper order for better sound quality
  melodySynth.connect(filter);
  harmonySynth.connect(filter);
  
  // Set initial volume with better defaults
  melodySynth.volume.value = -10;  // Reduced from -8
  harmonySynth.volume.value = -14;  // Reduced from -12
  
  // Start audio context on user interaction
  document.addEventListener('click', function() {
    if (Tone.context.state !== 'running') {
      Tone.start();
      audioStarted = true;
      // Show message that audio is ready
      showMessage('Audio is ready! Move your hands to play.');
    }
  });
  
  // Create a status element to show current note/chord
  const noteEl = document.createElement('div');
  noteEl.id = 'note-display';
  noteEl.className = 'note-indicator';
  document.body.appendChild(noteEl);
}

// Show message overlay
function showMessage(message, duration = 2000) {
  const messageEl = document.createElement('div');
  messageEl.style.position = 'fixed';
  messageEl.style.top = '50%';
  messageEl.style.left = '50%';
  messageEl.style.transform = 'translate(-50%, -50%)';
  messageEl.style.backgroundColor = 'rgba(0,0,0,0.8)';
  messageEl.style.color = 'white';
  messageEl.style.padding = '20px';
  messageEl.style.borderRadius = '10px';
  messageEl.style.zIndex = '1000';
  messageEl.style.fontSize = '24px';
  messageEl.style.fontFamily = 'Arial, sans-serif';
  messageEl.style.textAlign = 'center';
  messageEl.style.direction = 'rtl';
  messageEl.textContent = message;
  document.body.appendChild(messageEl);
  
  // Remove message after specified duration
  setTimeout(() => {
    document.body.removeChild(messageEl);
  }, duration);
}

// Create UI elements for scale and sound selection
function createUI() {
  const uiContainer = document.createElement('div');
  uiContainer.className = 'ui-container';
  document.body.appendChild(uiContainer);
  
  // Root note selector
  const rootSelector = document.createElement('select');
  rootSelector.className = 'ui-select';
  rootSelector.id = 'root-select';
  
  notes.forEach(note => {
    const option = document.createElement('option');
    option.value = note;
    option.textContent = note;
    rootSelector.appendChild(option);
  });
  
  // Scale selector
  const scaleSelector = document.createElement('select');
  scaleSelector.className = 'ui-select';
  scaleSelector.id = 'scale-select';
  
  Object.keys(scales).forEach(scale => {
    const option = document.createElement('option');
    option.value = scale;
    option.textContent = scale.charAt(0).toUpperCase() + scale.slice(1);
    scaleSelector.appendChild(option);
  });
  
  // Sound selector
  const soundSelector = document.createElement('select');
  soundSelector.className = 'ui-select';
  soundSelector.id = 'sound-select';
  
  Object.keys(soundPresets).forEach(sound => {
    const option = document.createElement('option');
    option.value = sound;
    option.textContent = sound.charAt(0).toUpperCase() + sound.slice(1);
    soundSelector.appendChild(option);
  });
  
  // Octave selector
  const octaveSelector = document.createElement('select');
  octaveSelector.className = 'ui-select';
  octaveSelector.id = 'octave-select';
  
  for (let i = 2; i <= 6; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Octave ${i}`;
    if (i === 4) option.selected = true;
    octaveSelector.appendChild(option);
  }
  
  // Create labels and add everything to UI container
  const createLabeledControl = (label, element) => {
    const container = document.createElement('div');
    container.className = 'ui-control';
    
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    
    container.appendChild(labelEl);
    container.appendChild(element);
    return container;
  };
  
  uiContainer.appendChild(createLabeledControl('Root Note:', rootSelector));
  uiContainer.appendChild(createLabeledControl('Scale:', scaleSelector));
  uiContainer.appendChild(createLabeledControl('Octave:', octaveSelector));
  uiContainer.appendChild(createLabeledControl('Sound:', soundSelector));
  
  // Add event listeners after creating the elements
  rootSelector.addEventListener('change', function() {
    selectedRoot = this.value;
    updateUI();
  });
  
  scaleSelector.addEventListener('change', function() {
    selectedScale = this.value;
    updateUI();
  });
  
  octaveSelector.addEventListener('change', function() {
    octave = parseInt(this.value);
    updateUI();
  });
  
  soundSelector.addEventListener('change', function() {
    selectedSound = this.value;
    updateSynths();
  });
}

// Update synths based on selected sound - with improved distortion prevention
function updateSynths() {
  const preset = soundPresets[selectedSound];
  
  try {
    // Stop all current sounds first
    melodySynth.triggerRelease();
    harmonySynth.releaseAll();
    
    // Wait for release to complete
    setTimeout(() => {
      // Completely rebuild synths for clean sound when changing
      
      // Dispose old synths
      melodySynth.dispose();
      harmonySynth.dispose();
      
      // Create new melody synth
      melodySynth = new Tone.Synth({
        oscillator: {
          type: preset.oscillator.type,
          modulationType: "sine"
        },
        envelope: {
          attack: preset.envelope.attack,
          decay: preset.envelope.decay,
          sustain: preset.envelope.sustain,
          release: preset.envelope.release
        },
        portamento: 0.02
      });
      
      // Create new harmony synth
      harmonySynth = new Tone.PolySynth({
        maxPolyphony: 6,
        voice: Tone.Synth,
        options: {
          oscillator: {
            type: preset.oscillator.type,
            modulationType: "sine"
          },
          envelope: {
            attack: preset.envelope.attack * 1.2,
            decay: preset.envelope.decay,
            sustain: preset.envelope.sustain,
            release: preset.envelope.release * 1.5
          },
          portamento: 0.02
        }
      });
      
      // Reconnect to the audio chain
      melodySynth.connect(filter);
      harmonySynth.connect(filter);
      
      // Restore volumes
      melodySynth.volume.value = rightHandVolume;
      harmonySynth.volume.value = leftHandVolume;
      
      // Reset playing states
      rightHandIsPlaying = false;
      leftHandIsPlaying = false;
      currentMelodyNote = null;
      currentChord = null;
      
      showMessage(`Swiched sound to ${selectedSound}`);
    }, 100);
  } catch (error) {
    console.error("Error updating synths:", error);
  }
}

// Create enhanced particle system for visualization with trails
function createParticleSystem() {
  const count = 6000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  
  // Create particles in multiple layers for more depth and interest
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Distribute particles in different patterns based on index ranges
    if (i < count * 0.7) {
      // Spherical distribution for 70% of particles
      const radius = 50 + (Math.random() * 10 - 5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
    } else if (i < count * 0.9) {
      // Disc/plane distribution for 20% of particles
      const discRadius = 70 * Math.sqrt(Math.random());
      const discTheta = Math.random() * Math.PI * 2;
      
      positions[i3] = discRadius * Math.cos(discTheta);
      positions[i3 + 1] = (Math.random() * 20 - 10);  // thin vertical spread
      positions[i3 + 2] = discRadius * Math.sin(discTheta);
    } else {
      // Tight core cluster for 10% of particles
      const coreRadius = 20 * Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = coreRadius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = coreRadius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = coreRadius * Math.cos(phi);
    }
    
    // Vary initial colors with a blue-purple gradient
    const depth = Math.sqrt(
      positions[i3] * positions[i3] +
      positions[i3 + 1] * positions[i3 + 1] +
      positions[i3 + 2] * positions[i3 + 2]
    ) / 70;
    
    colors[i3] = 0.3 + depth * 0.3;       // R: more red farther out
    colors[i3 + 1] = 0.3 + depth * 0.1;   // G: slight green
    colors[i3 + 2] = 0.9 - depth * 0.3;   // B: more blue in the center
    
    // Vary particle sizes for more visual interest
    sizes[i] = 0.5 + Math.random() * 1.5;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Custom shader material for better looking particles with trails
  const material = new THREE.PointsMaterial({
    size: 1.0,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    depthWrite: false  // prevents rendering artifacts
  });
  
  particles = new THREE.Points(geometry, material);
  
  // Store original positions for animation reference
  particles.userData = {
    originalPositions: new Float32Array(positions),
    velocities: new Float32Array(positions.length) // Add velocities array for smooth motion
  };
  
  scene.add(particles);
  
  // Add variables for animation
  noteChangeTime = 0;
  chordChangeTime = 0;
  lastAnimatedNote = null;
  lastAnimatedChord = null;
  particleExplosionFactor = 0;
  pulseFactor = 0;
  particleTargetPositions = [];
  animationIntensity = 0;
}

// Get video and canvas elements for hand tracking
function setupWebcamElements() {
  videoElement = document.querySelector('.input_video');
  canvasElement = document.querySelector('.output_canvas');
  
  if (canvasElement) {
    canvasCtx = canvasElement.getContext('2d');
  } else {
    console.error("Output canvas element not found!");
  }
}

// Display instructions - updated for inverted controls
function updateInstructions() {
  const instructionsEl = document.getElementById('instructions');
  if (instructionsEl) {
    instructionsEl.innerHTML = `
      <h2>Instructions</h2> 
      <p>Move your hands to play music!</p>
      <p>Right hand: Play melody notes</p>
      <p>Left hand: Play chords</p>
      <p>Pinch gesture: Control volume</p>
      <p>Select scale and sound from the UI</p>
      <p>Press 'Start Audio' to begin</p>
    `;
    instructionsEl.style.direction = 'rtl';
  }
}

// Handle window resizing
function onWindowResize() {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize hand tracking with MediaPipe
function setupHandTracking() {
  if (!videoElement || !canvasElement || !canvasCtx) {
    console.error("Video or Canvas element not ready for Hand Tracking setup.");
    return;
  }
  
  try {
    hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });
    
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.75, // Enhanced for better detection
      minTrackingConfidence: 0.75   // Enhanced for better tracking
    });
    
    hands.onResults(onHandResults);
    
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if (videoElement.readyState >= 2) {
          await hands.send({image: videoElement});
        }
      },
      width: 1420,
      height: 772
    });
    
    camera.start()
      .then(() => {
        console.log("Camera started successfully.");
        showMessage("Camera is on, Press 'Start Audio' to play.");
      })
      .catch(err => {
        console.error("Error starting webcam:", err);
        const instructions = document.getElementById('instructions');
        if (instructions) instructions.textContent = "Cannot access webcam. Please allow access.";
      });
    
  } catch (error) {
    console.error("Error setting up MediaPipe Hands:", error);
  }
}

// Calculate distance between two points
function calculateDistance(point1, point2) {
  if (!point1 || !point2) return Infinity;
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Enhanced map range function
function mapRange(value, inMin, inMax, outMin, outMax) {
  // Ensure value is within range
  value = Math.max(inMin, Math.min(inMax, value));
  // Perform the mapping
  const result = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  return result;
}

// Improved note mapping function with inverted direction (hand up = high pitch, hand down = low pitch)
function getNoteFromPosition(y, scale) {
  // Track position change
  const positionChanged = Math.abs(y - lastRightHandY) > 0.0001;
  lastRightHandY = y;
  
  // FIXED: Inverted mapping - higher hand position (lower y value) = higher note
  // Map from full range (0.0-1.0) to positions (0-14), but inverted
  const position = Math.floor(mapRange(y, 0.0, 1.0, 14, 0));
  
  // Debug output
  // console.log(`Hand Y: ${y.toFixed(3)} → Position: ${position}`);
  
  const scaleArray = scales[scale];
  const octaveOffset = Math.floor(position / scaleArray.length);
  const indexInScale = position % scaleArray.length;
  
  const semitones = scaleArray[indexInScale];
  const rootIndex = notes.indexOf(selectedRoot);
  const midiBase = 60 + rootIndex;
  const midiNote = midiBase + semitones + (octave - 4 + octaveOffset) * 12;
  
  const noteIndex = midiNote % 12;
  const noteOctave = Math.floor(midiNote / 12) - 1;
  const noteName = notes[noteIndex] + noteOctave;
  
  if (positionChanged) {
    // console.log(`Hand Y: ${y.toFixed(3)} → Position: ${position} → Note: ${noteName}`);
  }
  
  return noteName;
}

// Improved chord position mapping with inverted direction (hand up = high pitch, hand down = low pitch)
function getChordFromPosition(y) {
  // Track position change
  const positionChanged = Math.abs(y - lastLeftHandY) > 0.0001;
  lastLeftHandY = y;
  
  // FIXED: Inverted mapping - higher hand position (lower y value) = higher chord position
  // Map from full range (0.0-1.0) to chord positions (0-7), but inverted
  const position = Math.floor(mapRange(y, 0.5, 1.0, 7, 0));
  
  // Debug output
  // console.log(`Left Hand Y: ${y.toFixed(3)} → Chord Position: ${position}`);
  
  const scaleArray = scales[selectedScale];
  const scaleDegree = position % scaleArray.length;
  
  // Get root note for this scale degree
  const rootIndex = notes.indexOf(selectedRoot);
  const degreeOffset = scaleArray[scaleDegree];
  const chordRootIndex = (rootIndex + degreeOffset) % 12;
  const chordRoot = notes[chordRootIndex];
  
  // Determine chord type
  let chordType;
  if (selectedScale === 'major') {
    const chordTypes = ['major', 'minor', 'minor', 'major', 'dominant7', 'minor', 'diminished'];
    chordType = chordTypes[scaleDegree % 7];
  } else if (selectedScale === 'minor') {
    const chordTypes = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
    chordType = chordTypes[scaleDegree % 7];
  } else if (selectedScale === 'majorBlues') {
    const chordTypes = ['dominant7', 'diminished', 'dominant7', 'diminished', 'dominant7', 'minor', 'diminished'];
    chordType = chordTypes[scaleDegree % 7];
  } else if (selectedScale === 'minorBlues') {
    const chordTypes = ['minor7', 'dominant7', 'minor7', 'diminished', 'minor7', 'diminished', 'dominant7'];
    chordType = chordTypes[scaleDegree % 7];
  }
  
  else {
    chordType = scaleDegree % 2 === 0 ? 'major' : 'minor';
  }
  
  // Generate chord notes
  const chordNotes = [];
  const intervals = chordTypes[chordType];
  
  const octaveOffset = Math.floor(position / 7);
  const midiBase = 48 + chordRootIndex + (octave - 4 + octaveOffset) * 12;
  
  intervals.forEach(interval => {
    const midiNote = midiBase + interval;
    const noteIndex = midiNote % 12;
    const noteOctave = Math.floor(midiNote / 12) - 1;
    chordNotes.push(notes[noteIndex] + noteOctave);
  });
  
  const chord = {
    root: chordRoot,
    type: chordType,
    notes: chordNotes,
    name: `${chordRoot} ${chordType === 'major' ? '' : chordType === 'minor' ? 'm' : chordType === 'minor7' ? 'm7' : chordType === 'diminished' ? 'dim' : chordType === 'augmented' ? 'aug' : chordType}`
  };
  
  // Debug output
  if (positionChanged) {
    // console.log(`Hand Y: ${y.toFixed(3)} → Position: ${position} → Chord: ${chord.name}`);
  }
  
  return chord;
}

// FIXED: Improved melody note function with reduced distortion and animation triggers
function playMelodyNote(note) {
  if (!audioStarted) return;
  
  // Check if the note has actually changed
  const noteChanged = note !== lastMelodyNote;
  lastMelodyNote = note;
  
  try {
    if (!rightHandIsPlaying) {
      // First time playing a note
      melodySynth.triggerAttack(note, Tone.now(), 0.8);  // Reduced velocity for cleaner sound
      rightHandIsPlaying = true;
      currentMelodyNote = note;
      
      // Trigger animation effect for new note
      noteChangeTime = Date.now() * 0.001;
      particleExplosionFactor = 1.0;
      
      console.log("Started playing melody note:", note);
    } else if (noteChanged) {
      // FIXED: Use proper scheduled timing for clean note transitions
      const now = Tone.now();
      
      // Release the current note with a precise timestamp
      melodySynth.triggerRelease(now + 0.02);
      
      // Schedule the attack of the new note with a slight delay
      melodySynth.triggerAttack(note, now + 0.07, 0.7);
      currentMelodyNote = note;
      
      // Trigger animation effect for note change
      noteChangeTime = Date.now() * 0.001;
      particleExplosionFactor = 0.8;
      
      console.log("Changed melody note to:", note);
    }
    
    updateNoteDisplay();
    updateVisualKeyboard();
  } catch (error) {
    console.error("Error playing melody note:", error);
  }
}

// FIXED: Complete revision of chord playing to eliminate distortion and enhance animation
function playChord(chord) {
  if (!audioStarted) return;
  
  // Check if the chord has actually changed by comparing note arrays
  const chordChanged = !lastChord || 
                       JSON.stringify(chord.notes) !== JSON.stringify(lastChord.notes);
  
  try {
    if (!leftHandIsPlaying) {
      // First-time playing
      harmonySynth.triggerAttack(chord.notes, Tone.now(), 0.6);  // Reduced velocity for softer attack
      leftHandIsPlaying = true;
      currentChord = chord;
      lastChord = {...chord}; // Make a copy to prevent reference issues
      
      // Trigger animation effects for new chord
      chordChangeTime = Date.now() * 0.001;
      pulseFactor = 1.0;
      
      console.log("Started playing chord:", chord.name, chord.notes);
    } else if (chordChanged) {
      // CRITICAL FIX: Using proper sequence to eliminate distortion
      
      // 1. Release all current notes in the past to ensure clean release
      harmonySynth.releaseAll(Tone.now() - 0.005);
      
      // 2. Dispose of the synth and recreate it only if necessary
      if (harmonySynth && harmonySynth.dispose) {
          harmonySynth.dispose();
      }
      harmonySynth = new Tone.PolySynth({
        maxPolyphony: 8,
        voice: Tone.Synth,
        options: {
          oscillator: {
            type: soundPresets[selectedSound].oscillator.type,
            modulationType: "sine"
          },
          envelope: {
            attack: soundPresets[selectedSound].envelope.attack * 1.2,
            decay: soundPresets[selectedSound].envelope.decay,
            sustain: soundPresets[selectedSound].envelope.sustain,
            release: soundPresets[selectedSound].envelope.release * 1.5
          },
          portamento: 0.02
        }
      });
      harmonySynth.connect(filter);
      harmonySynth.volume.value = leftHandVolume;
      // 3. Play the new chord with minimal delay using Tone.now()
      harmonySynth.triggerAttack(chord.notes, Tone.now(), 0.6);
      currentChord = chord;
      lastChord = {...chord};
      chordChangeTime = Date.now() * 0.0001;
      console.log("Changed chord to:", chord.name, chord.notes);
    }
    
    updateNoteDisplay();
    updateVisualKeyboard();
  } catch (error) {
    console.error("Error playing chord:", error);
  }
}

// Stop melody
function stopMelody() {
  if (rightHandIsPlaying) {
    melodySynth.triggerRelease();
    rightHandIsPlaying = false;
    currentMelodyNote = null;
    updateNoteDisplay();
    updateVisualKeyboard();
    console.log("Stopped melody");
  }
}

// Stop chord - FIXED to ensure chords actually stop
function stopChord() {
  if (leftHandIsPlaying) {
    // Use releaseAll instead of triggerRelease for PolySynth
    harmonySynth.releaseAll();
    
    // More aggressive approach to ensure sound stops
    setTimeout(() => {
      // If sound is still playing, rebuild the synth
      if (leftHandIsPlaying) {
        harmonySynth.dispose();
        
        // Recreate harmony synth with same settings
        harmonySynth = new Tone.PolySynth({
          maxPolyphony: 8,
          voice: Tone.Synth,
          options: {
            oscillator: {
              type: soundPresets[selectedSound].oscillator.type,
              modulationType: "sine"
            },
            envelope: {
              attack: soundPresets[selectedSound].envelope.attack * 1.2,
              decay: soundPresets[selectedSound].envelope.decay,
              sustain: soundPresets[selectedSound].envelope.sustain,
              release: soundPresets[selectedSound].envelope.release * 1.5
            },
            portamento: 0.02
          }
        });
        
        // Reconnect to audio chain
        harmonySynth.connect(filter);
        harmonySynth.volume.value = leftHandVolume;
      }
    }, 100);
    
    leftHandIsPlaying = false;
    currentChord = null;
    updateNoteDisplay();
    updateVisualKeyboard();
    console.log("Stopped chord");
  }
}

// Update note display
function updateNoteDisplay() {
  const noteEl = document.getElementById('note-display');
  if (!noteEl) return;
  
  let displayText = '';
  
  if (currentChord && leftHandIsPlaying) {
    displayText += `Chord: ${currentChord.name}`;
  }
  
  if (currentMelodyNote && rightHandIsPlaying) {
    if (displayText) displayText += ' | ';
    displayText += `Note: ${currentMelodyNote}`;
  }
  
  if (!displayText) {
    displayText = `Scale: ${selectedRoot} ${selectedScale}`;
  }
  
  noteEl.textContent = displayText;
  noteEl.style.direction = 'rtl';
  noteEl.className = 'note-indicator' + ((leftHandIsPlaying || rightHandIsPlaying) ? ' playing' : '');
}

// Set volume based on pinch distance - INVERTED: pinch = soft, open hand = loud
function setVolume(hand, pinchDistance) {
  if (!audioStarted) return; // Only adjust volume if audio is started
  

  // Map pinch distance to volume (closer fingers = softer)
  const volume = mapRange(pinchDistance, MIN_PINCH_DIST, MAX_PINCH_DIST, -70, -15);
  
  if (hand === 'left') {
    leftHandVolume = volume;
    harmonySynth.volume.value = volume;
    console.log("Left hand volume:", volume);
  } else {
    rightHandVolume = volume;
    melodySynth.volume.value = volume;
    console.log("Right hand volume:", volume);
  }
}

// FIXED: Updated note position markers for inverted range
function createNoteMarkers() {
  const markerContainer = document.getElementById('note-markers');
  if (!markerContainer) return;
  
  // Clear existing markers
  markerContainer.innerHTML = '';
  
  const gridLines = 0; // Two octaves
  
  for (let i = 0; i <= gridLines; i++) {
    // FIXED: Distribute markers across full screen height
    const y = mapRange(i, 0, gridLines, 5, 50); // % of screen height
    
    const marker = document.createElement('div');
    marker.className = i === 7 ? 'marker octave-divider' : 'marker';
    marker.style.top = `${y}%`;
    
    // Add label for every other marker
    if (i % 2 === 0 && i < gridLines) {
      const label = document.createElement('div');
      label.className = 'marker-label';
      // FIXED: Apply inverted mapping (higher hand = higher pitch)
      const note = getNoteFromPosition(mapRange(i, 0, gridLines, 1.0, 0.0), selectedScale);
      label.textContent = note;
      label.style.top = `${y}%`;
      markerContainer.appendChild(label);
    }
    
    markerContainer.appendChild(marker);
  }
}

// Create visual keyboard representation with inverted direction
function createVisualKeyboard() {
  const keyboardContainer = document.getElementById('keyboard-visual');
  if (!keyboardContainer) return;
  

}

// Update the visual keyboard when a note is played
function updateVisualKeyboard() {
  const keyboardContainer = document.getElementById('keyboard-visual');
  if (!keyboardContainer) return;
  
  // Reset all keys
  const keys = keyboardContainer.querySelectorAll('.key');
  keys.forEach(key => key.classList.remove('active'));
  
  // Highlight active keys
  if (currentMelodyNote && leftHandIsPlaying) {
    // Find the matching key for the current melody note
    keys.forEach(key => {
      if (key.dataset.note === currentMelodyNote) {
        key.classList.add('active');
      }
    });
  }
  
  if (currentChord && rightHandIsPlaying) {
    // Find keys for each note in the chord
    currentChord.notes.forEach(chordNote => {
      keys.forEach(key => {
        if (key.dataset.note === chordNote) {
          key.classList.add('active');
        }
      });
    });
  }
}

// Update note display to reflect current scale selection with inverted direction
function updateNoteMarkers() {
  const markerContainer = document.getElementById('note-markers');
  if (!markerContainer) return;
  
  // Remove existing labels
  const labels = markerContainer.querySelectorAll('.marker-label');
  labels.forEach(label => label.remove());
  
  // // Add new labels based on current scale
  // const gridLines = 14; // Two octaves
  
  // for (let i = 0; i <= gridLines; i += 2) {
  //   if (i < gridLines) {
  //     // FIXED: Distribute markers across full screen height
  //     const y = mapRange(i, 0, gridLines, 5, 95); // % of screen height
      
  //     const label = document.createElement('div');
  //     label.className = 'marker-label';
  //     // FIXED: Apply inverted mapping for consistent direction
  //     const note = getNoteFromPosition(mapRange(i, 0, gridLines, 1.0, 0.0), selectedScale);
  //     label.textContent = note;
  //     label.style.top = `${y}%`;
  //     markerContainer.appendChild(label);
  //   }
  // }
}

// Update UI elements when scale or root changes
function updateUI() {
  updateNoteDisplay();
  updateNoteMarkers();
  createVisualKeyboard(); // Recreate the keyboard with new notes
  console.log("UI updated with scale:", selectedScale, "root:", selectedRoot, "octave:", octave);
}

// FIXED: Improved note grid drawing for inverted direction
function drawNoteGrid(ctx, canvasWidth, canvasHeight) {
  const gridLines = 16; // Two octaves
  
  ctx.save();
  
  // Draw horizontal lines for the notes
  for (let i = 0; i <= gridLines; i++) {
    // FIXED: Distribute grid lines across full screen height
    const y = mapRange(i, 0, gridLines, 0.05, 0.95) * canvasHeight;
    
    // Change style for the center dividing line (between octaves)
    if (i === 7) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
    }
    
    // Draw the line
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
    
    // Draw note labels
    if (i < gridLines) { // Don't draw label for the last line
      ctx.font = '12px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      // FIXED: Apply inverted mapping
      const noteName = getNoteFromPosition(mapRange(i, 0, gridLines, 1.0, 0.0), selectedScale);
      ctx.fillText(noteName, 5, y - 5);
    }
  }
  
  ctx.restore();
}

// Function to help with debugging hand positions
function debugHandPositions() {
  // if (isLeftHandPresent && leftHandLandmarks) {
  //   console.log("Left hand Y position:", leftHandLandmarks[0].y.toFixed(3));
  //   console.log("Current chord:", currentChord ? currentChord.name : "none");
  // }
  
  // if (isRightHandPresent && rightHandLandmarks) {
  //   console.log("Right hand Y position:", rightHandLandmarks[0].y.toFixed(3));
  //   console.log("Current note:", currentMelodyNote);
  // }
}

// Process detected hands - with updated visual feedback for inverted volume
function onHandResults(results) {
  if (!canvasCtx || !canvasElement) return;
  
  // Display a message if hands are detected
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const handCount = results.multiHandLandmarks.length;
    if (!handDetected) {
      console.log(`Detected ${handCount} hand(s)`);
    }
  }
  
  // Reset hand states
  let wasLeftHandPresent = isLeftHandPresent;
  let wasRightHandPresent = isRightHandPresent;
  isLeftHandPresent = false;
  isRightHandPresent = false;
  leftHandLandmarks = null;
  rightHandLandmarks = null;
  handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
  
  // Drawing setup
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Draw the note grid
  drawNoteGrid(canvasCtx, canvasElement.width, canvasElement.height);
  
  // Process detected hands
  if (handDetected) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      if (!results.multiHandedness || !results.multiHandedness[i]) continue;
      
      const classification = results.multiHandedness[i];
      const landmarks = results.multiHandLandmarks[i];
      const isLeft = classification.label === 'Left';
      
      // Assign landmarks based on handedness
      if (!isLeft) {
        isLeftHandPresent = true;
        leftHandLandmarks = landmarks;
        
        // LEFT HAND: Vertical position controls harmony/chords
        if (landmarks && landmarks.length > 8) {
          const wrist = landmarks[0];
          
          // Ensure wrist position is valid
          if (wrist && typeof wrist.y === 'number') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const pinchDist = calculateDistance(thumbTip, indexTip);
            
            // Volume control with pinch distance
            setVolume('left', pinchDist);
            
            // Get chord based on hand height
            const chord = getChordFromPosition(wrist.y);
            
            // Playing or not based on hand presence
            playChord(chord);
            
            // Update chord visualizer
            const chordViz = document.querySelector('.chord-viz');
            if (chordViz) {
              chordViz.classList.add('chord-active');
            }
            
            // Draw chord name above hand
            canvasCtx.font = 'bold 24px Arial';
            canvasCtx.fillStyle = 'white';
            canvasCtx.fillText(chord.name, 
              (wrist.x * canvasElement.width) - 15,
              (wrist.y * canvasElement.height) - 30);
            
            // FIXED: Visual feedback for volume (pinch) - inverted (pinch = soft, open = loud)
            const volumeLevel = mapRange(pinchDist, MIN_PINCH_DIST, MAX_PINCH_DIST, 0, 1);
            canvasCtx.beginPath();
            canvasCtx.arc(
              (thumbTip.x + indexTip.x) / 2 * canvasElement.width,
              (thumbTip.y + indexTip.y) / 2 * canvasElement.height,
              20 * volumeLevel, 0, Math.PI * 2
            );
            canvasCtx.fillStyle = `rgba(200, 55, 100, ${volumeLevel})`;
            canvasCtx.fill();
            
            // Draw a line connecting thumb and index finger
            canvasCtx.beginPath();
            canvasCtx.moveTo(thumbTip.x * canvasElement.width, thumbTip.y * canvasElement.height);
            canvasCtx.lineTo(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height);
            canvasCtx.strokeStyle = 'rgb(255, 230, 0)';
            canvasCtx.lineWidth = 3;
            canvasCtx.stroke();
          } else {
            console.error("Invalid left wrist position detected");
          }
        }
      } else {
        // RIGHT HAND: Controls melody
        isRightHandPresent = true;
        rightHandLandmarks = landmarks;
        
        if (landmarks && landmarks.length > 8) {
          const wrist = landmarks[0];
          
          // Ensure wrist position is valid
          if (wrist && typeof wrist.y === 'number') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const pinchDist = calculateDistance(thumbTip, indexTip);
            
            // Volume control with pinch distance
            setVolume('right', pinchDist);
            
            // Get melody note based on hand height
            const note = getNoteFromPosition(wrist.y, selectedScale);
            
            // Play the note
            playMelodyNote(note);
            
            // Update note visualizer
            const noteViz = document.querySelector('.note-viz');
            if (noteViz) {
              noteViz.classList.add('note-active');
            }
            
            // Draw note name above hand
            canvasCtx.font = 'bold 24px Arial';
            canvasCtx.fillStyle = 'magenta';
            canvasCtx.fillText(note, 
              (wrist.x * canvasElement.width) - 15,
              (wrist.y * canvasElement.height) - 30);
            
            // FIXED: Visual feedback for volume (pinch) - inverted (pinch = soft, open = loud)
            const volumeLevel = mapRange(pinchDist, MIN_PINCH_DIST, MAX_PINCH_DIST, 0, 1);
            canvasCtx.beginPath();
            canvasCtx.arc(
              (thumbTip.x + indexTip.x) / 2 * canvasElement.width,
              (thumbTip.y + indexTip.y) / 2 * canvasElement.height,
              20 * volumeLevel, 0, Math.PI * 2
            );
            canvasCtx.fillStyle = `rgba(100, 100, 255, ${volumeLevel})`;
            canvasCtx.fill();
            
            // Draw a line connecting thumb and index finger
            canvasCtx.beginPath();
            canvasCtx.moveTo(thumbTip.x * canvasElement.width, thumbTip.y * canvasElement.height);
            canvasCtx.lineTo(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height);
            canvasCtx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
            canvasCtx.lineWidth = 5;
            canvasCtx.stroke();
          } else {
            console.error("Invalid right wrist position detected");
          }
        }
      }
      
      // Draw hand landmarks and connections
      const color = isLeft ? 'rgba(0, 255, 200, 0.8)' : 'rgb(231, 150, 0)';
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: color, lineWidth: 10 });
      drawLandmarks(canvasCtx, landmarks, { color: color, lineWidth: 1, radius: 2 });
    }
    
    // Call debug function to help diagnose issues
    debugHandPositions();
  } else {
    // No hands detected, stop playing
    stopMelody();
    stopChord();
    
    // Reset visualizers
    const chordViz = document.querySelector('.chord-viz');
    const noteViz = document.querySelector('.note-viz');
    if (chordViz) chordViz.classList.remove('chord-active');
    if (noteViz) noteViz.classList.remove('note-active');
  }
  
  // Stop sounds if hands disappear
  if (!isLeftHandPresent && wasLeftHandPresent) {
    stopMelody();
    const noteViz = document.querySelector('.note-viz');
    if (noteViz) noteViz.classList.remove('note-active');
  }
  
  if (!isRightHandPresent && wasRightHandPresent) {
    stopChord();
    const chordViz = document.querySelector('.chord-viz');
    if (chordViz) chordViz.classList.remove('chord-active');
  }
  
  canvasCtx.restore();
}

// Animation loop with enhanced musical reactivity and smooth trails
function animate() {
  requestAnimationFrame(animate);
  
  const now = Date.now() * 0.001;
  
  // Apply trail effect by not fully clearing the canvas
  // Draw a semi-transparent overlay instead of clearing
  if (renderer && scene && camera) {
    // Add a transparent overlay to create fade effect rather than clearing
    const fadeSpeed = leftHandIsPlaying || rightHandIsPlaying ? 0.12 : 0.15;
    renderer.clearColor(0, 0, 0, fadeSpeed);  // Faster fade when playing
  }
  
  // Smooth transitions for animation values using lerp
  animationIntensity = lerp(animationIntensity, 
                           (leftHandIsPlaying || rightHandIsPlaying) ? 1.0 : 0.0, 
                           0.05);
  
  // Smooth decay of effect triggers
  particleExplosionFactor *= 0.95; // Decay explosion effect
  pulseFactor *= 0.94; // Decay pulse effect
  
  // Check for changes in notes/chords to trigger animations
  if (currentMelodyNote !== lastAnimatedNote) {
    noteChangeTime = now;
    lastAnimatedNote = currentMelodyNote;
    particleExplosionFactor = 1.0; // Trigger explosion effect
    
    // Create target positions for particles based on note pitch
    if (currentMelodyNote) {
      const noteParts = currentMelodyNote.match(/([A-G]#?)(\d+)/);
      if (noteParts) {
        const noteRoot = noteParts[1];
        const noteOctave = parseInt(noteParts[2]);
        const noteIndex = notes.indexOf(noteRoot);
        
        // Map note to vertical position for particle movement
        const verticalBias = (noteIndex + (noteOctave - 2) * 12) / 60;
        
        // Reset target positions for particles
        particleTargetPositions = [];
      }
    }
  }
  
  if (currentChord !== lastAnimatedChord && currentChord) {
    chordChangeTime = now;
    lastAnimatedChord = currentChord;
    pulseFactor = 1.0; // Trigger pulse effect
  }
  
  // Calculate musical energy for animation
  let musicalEnergy = 0;
  
  if (rightHandIsPlaying && currentMelodyNote) {
    const noteParts = currentMelodyNote.match(/([A-G]#?)(\d+)/);
    if (noteParts) {
      const noteRoot = noteParts[1];
      const noteOctave = parseInt(noteParts[2]);
      const noteIndex = notes.indexOf(noteRoot);
      // Higher notes create more energy
      musicalEnergy = 0.5 + (noteIndex + (noteOctave - 2) * 12) / 48;
    }
  }
  
  if (leftHandIsPlaying && currentChord) {
    // Different chord types create different energy patterns
    const chordEnergyMap = {
      'major': 0.5,
      'minor': 0.4,
      'dominant7': 0.7,
      'minor7': 0.6,
      'diminished': 0.8,
      'augmented': 0.9
    };
    
    const chordEnergy = chordEnergyMap[currentChord.type] || 0.5;
    musicalEnergy = Math.max(musicalEnergy, chordEnergy);
  }
  
  // Update particle animation with enhanced reactivity and smoother motion
  if (particles) {
    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;
    const sizes = particles.geometry.attributes.size ? particles.geometry.attributes.size.array : null;
    const originalPositions = particles.userData ? particles.userData.originalPositions : null;
    
    // Store original positions if not already stored
    if (!particles.userData) {
      particles.userData = {
        originalPositions: new Float32Array(positions.length),
        velocities: new Float32Array(positions.length) // Add velocity for smoother motion
      };
      for (let i = 0; i < positions.length; i++) {
        particles.userData.originalPositions[i] = positions[i];
        particles.userData.velocities[i] = 0; // Initialize velocities to zero
      }
    }
    
    // Calculate time factors for animation
    const noteChangeAge = now - noteChangeTime;
    const chordChangeAge = now - chordChangeTime;
    
    // Animate particles with smoother motion using velocity
    for (let i = 0; i < positions.length; i += 3) {
      const i3 = i / 3;
      const originalX = particles.userData.originalPositions[i];
      const originalY = particles.userData.originalPositions[i+1];
      const originalZ = particles.userData.originalPositions[i+2];
      
      // Calculate distance from center for various effects
      const distance = Math.sqrt(
        originalX * originalX + 
        originalY * originalY + 
        originalZ * originalZ
      );
      
      // Create wave-like motion synchronized with music
      const waveFrequency = 0.5 + musicalEnergy * 2;
      const wavePhase = distance * 0.1;
      
      // Calculate amplitude based on musical elements
      const baseAmplitude = 0.05 * (1 + animationIntensity * 5);
      
      // Apply melody-based vertical movement
      let verticalBias = 0;
      if (rightHandIsPlaying && currentMelodyNote) {
        const noteParts = currentMelodyNote.match(/([A-G]#?)(\d+)/);
        if (noteParts) {
          const noteRoot = noteParts[1];
          const noteOctave = parseInt(noteParts[2]);
          const noteIndex = notes.indexOf(noteRoot);
          // Higher notes move particles upward
          verticalBias = (noteIndex + (noteOctave - 3) * 12) / 36;
        }
      }
      
      // Apply note change explosion effect - smoother wave
      const explosionEffect = particleExplosionFactor * Math.sin(noteChangeAge * 8) * 
                             Math.exp(-noteChangeAge * 2.5) * distance * 0.01;
      
      // Apply chord change pulse effect
      const pulseEffect = pulseFactor * Math.sin(chordChangeAge * 6) * 
                         Math.exp(-chordChangeAge * 1.8) * 0.2;
      
      // Target positions - combine all movement effects
      const targetX = originalX + 
                    Math.sin(now * waveFrequency + wavePhase) * baseAmplitude * originalX + 
                    explosionEffect * originalX;
                     
      const targetY = originalY + 
                    Math.cos(now * waveFrequency + wavePhase) * baseAmplitude * originalY + 
                    explosionEffect * originalY + 
                    verticalBias * animationIntensity * 4;
                       
      const targetZ = originalZ + 
                    Math.sin(now * waveFrequency * 0.7 + wavePhase) * baseAmplitude * originalZ + 
                    explosionEffect * originalZ;
      
      // Apply smoother motion using velocity approach (momentum/inertia)
      const smoothFactor = 0.05; // How quickly to reach target (lower = smoother but slower)
      
      // Update velocities with smoother acceleration
      particles.userData.velocities[i] = lerp(
        particles.userData.velocities[i], 
        (targetX - positions[i]) * 0.2, 
        smoothFactor
      );
      
      particles.userData.velocities[i+1] = lerp(
        particles.userData.velocities[i+1], 
        (targetY - positions[i+1]) * 0.2, 
        smoothFactor
      );
      
      particles.userData.velocities[i+2] = lerp(
        particles.userData.velocities[i+2], 
        (targetZ - positions[i+2]) * 0.2, 
        smoothFactor
      );
      
      // Apply velocities to positions
      positions[i] += particles.userData.velocities[i];
      positions[i+1] += particles.userData.velocities[i+1];
      positions[i+2] += particles.userData.velocities[i+2];
      
      // Update particle sizes if available - make them pulse with the music
      if (sizes) {
        const baseSize = 0.5 + Math.random() * 1.5; // original assigned size
        const pulsingEffect = musicalEnergy * 0.5 * Math.sin(now * 6 + i3 * 0.05);
        sizes[i3] = baseSize + pulsingEffect + (explosionEffect * 3) + pulseEffect; 
      }
      
      // Enhanced color effects based on music
      if (leftHandIsPlaying && currentChord) {
        // Enhanced chord colors with pulse effect
        const chordRootIndex = notes.indexOf(currentChord.root);
        const hue = chordRootIndex / 12;
        
        // Different color schemes for different chord types
        let saturation, lightness;
        
        if (currentChord.type === 'major') {
          saturation = 0.7 + pulseEffect * 0.3;
          lightness = 0.6 + pulseEffect * 0.2;
        } else if (currentChord.type === 'minor') {
          saturation = 0.5 + pulseEffect * 0.3;
          lightness = 0.4 + pulseEffect * 0.2;
        } else if (currentChord.type.includes('7')) {
          saturation = 0.8 + pulseEffect * 0.2;
          lightness = 0.5 + pulseEffect * 0.3;
        } else if (currentChord.type === 'diminished') {
          saturation = 0.9;
          lightness = 0.3 + pulseEffect * 0.4;
        } else {
          saturation = 0.6 + pulseEffect * 0.4;
          lightness = 0.5 + pulseEffect * 0.3;
        }
        
        // Distance-based color variation for more depth
        const distanceFactor = Math.min(1, distance / 50);
        saturation *= (0.8 + distanceFactor * 0.2);
        lightness *= (0.8 + distanceFactor * 0.2);
        
        // Convert HSL to RGB with animated variation
        const h = (hue + now * 0.05 * (currentChord.type === 'diminished' ? 0.3 : 0.1)) * 6;
        const s = saturation;
        const l = lightness;
        
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          
          r = hue2rgb(p, q, (h + 2) / 6);
          g = hue2rgb(p, q, h / 6);
          b = hue2rgb(p, q, (h + 4) / 6);
        }
        
        colors[i] = r;
        colors[i+1] = g;
        colors[i+2] = b;
      } else if (rightHandIsPlaying && currentMelodyNote) {
        // Enhanced melody note colors with explosion effect
        const noteRoot = currentMelodyNote.slice(0, -1);
        const noteIndex = notes.indexOf(noteRoot);
        const hue = noteIndex / 12;
        
        // Extract octave for brightness variation
        const noteOctave = parseInt(currentMelodyNote.slice(-1));
        const octaveBrightness = (noteOctave - 2) / 5; // Normalize octave range
        
        // Create pulsing effect synchronized with note changes
        const notePulse = Math.sin(noteChangeAge * 12) * Math.exp(-noteChangeAge * 4) * 0.3;
        
        // Convert HSL to RGB with reactive animation
        const h = (hue + now * 0.1) * 6; // Slowly shift hue over time
        const s = 0.8 + notePulse * 0.2;
        const l = 0.5 + octaveBrightness * 0.3 + notePulse * 0.2;
        
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          
          r = hue2rgb(p, q, (h + 2) / 6);
          g = hue2rgb(p, q, h / 6);
          b = hue2rgb(p, q, (h + 4) / 6);
        }
        
        // Add shimmer effect for higher notes
        if (noteOctave > 4) {
          const shimmer = Math.sin(now * 20 + i3) * 0.1 * (noteOctave - 4) / 3;
          r = Math.min(1, r + shimmer);
          g = Math.min(1, g + shimmer);
          b = Math.min(1, b + shimmer);
        }
        
        colors[i] = r;
        colors[i+1] = g;
        colors[i+2] = b;
      } else {
        // Default ambient color with gentle pulsing
        const pulseRate = 0.2;
        const pulseMagnitude = 0.1;
        const pulse = Math.sin(now * pulseRate) * pulseMagnitude;
        
        colors[i] = 0.3 + pulse * 0.1;
        colors[i+1] = 0.3 + pulse * 0.1;
        colors[i+2] = 0.8 + pulse * 0.2;
      }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
    if (sizes) particles.geometry.attributes.size.needsUpdate = true;
    
    // Enhance particle system rotation based on musical activity
    const rotationSpeed = 0.002 * (1 + animationIntensity);
    particles.rotation.y += rotationSpeed;
    
    if (leftHandIsPlaying || rightHandIsPlaying) {
      // Create more complex rotation patterns when music is playing
      const chordFactor = currentChord ? 
                         (currentChord.type === 'major' ? 0.5 : 
                          currentChord.type === 'minor' ? -0.3 : 
                          currentChord.type.includes('7') ? 0.7 : 0.1) : 0;
      
      particles.rotation.z += 0.001 * (1 + chordFactor);
      particles.rotation.x += 0.0005 * animationIntensity;
    }
  }
  
  // Render the scene with trails
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// Linear interpolation helper for smoother transitions
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}