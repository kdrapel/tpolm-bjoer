# Bjoer — TPOLM

Double-click `Start.cmd`, then click **Start intro**. Keep the server window
open. Windows PowerShell is sufficient; no Python or npm install is needed.
Alternatively: `node server.mjs`, then http://localhost:1997.

Space pauses, arrows and the −15s/+15s buttons seek fifteen seconds,
F toggles fullscreen, and Esc stops. The timeline previews your chosen
position while dragging and seeks when released. A Loading overlay stays
visible until the new graphics frame and music are ready.
Volume changes the MXM replay level. Stats for nerds is an on/off switch
showing displayed FPS and a compact sixteen-channel MXM tracker. Its rows
scroll upward using the music replay's row events and the audio clock.

Graphics and music are computed by JavaScript. There are no recorded frames,
screenshots, prerecorded audio, emulator executables, or development tools.
The original native MXM samples and patterns are included. The two static
landing logos are extracted from JS-rendered frames with original bitmap masks.
The looping landing background executes complete original graphics frames from
seconds 2–6, before the first number trigger, including original compositing.
It uses the original live VGA palette and a neutral dark overlay for readability.
Playback centers the320x200 picture inside a320x240 canvas as Nation0 does;
fullscreen uses the browser Fullscreen API, with controls hidden in that mode.

Current port limits: playback ends at 170 seconds. Full original startup,
original IRQ/display timing, and shutdown are unfinished. The frame schedule
is provisional. The software audio mixer is not a bit-exact GUS implementation;
comparison with an independently rendered WAV is pending. Sound runs continuously
when graphics cannot keep up; slow rendering can still cause visual lag.

`data/js-seek-checkpoints` contains compressed JS machine states needed for
responsive seeking, not playable frames. Every displayed intro frame is freshly
computed after restoring state. The runtime data remains tied to this intro;
this is not a general-purpose emulator or tracker application.

Graphics checkpoints are spaced five seconds apart. Music checkpoints in
`data/audio-seek-checkpoints` are spaced fifteen seconds apart and retain the
original tracker state, mixer voices and fractional tick position. They contain
no recorded audio. Seeking restores the preceding checkpoint and computes
forward; a small in-memory cache speeds repeated jumps. The audio context uses
48 kHz to match these checkpoints.
