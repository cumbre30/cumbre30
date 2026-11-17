#!/usr/bin/env bash
# Render del reel Cumbre30 (1080x1920, 30 fps): zoompan Ken Burns por
# segmento (alternando in/out con paneo sutil) + xfade + música.
set -euo pipefail
cd /tmp/kit
SEGS=(salida/reel/seg1.png salida/reel/seg2.png salida/reel/seg3.png salida/reel/seg4.png salida/reel/seg5.png salida/reel/seg6.png)
D=135        # frames por segmento (4.5 s @30fps)
FPS=30
XF=0.5       # duración de la transición

echo "[1/3] segmentos Ken Burns..."
i=0
for seg in "${SEGS[@]}"; do
  i=$((i+1))
  case $((i % 3)) in
    0) ZEXPR="min(1.10-0.0007*on,1.10)"; XEXPR="iw/2-(iw/zoom)/2"; YEXPR="ih/2-(ih/zoom)/2-30*(on/$D)";;   # out
    1) ZEXPR="min(1+0.0007*on,1.10)"; XEXPR="iw/2-(iw/zoom)/2"; YEXPR="ih/2-(ih/zoom)/2";;                  # in centro
    2) ZEXPR="min(1+0.0007*on,1.10)"; XEXPR="iw/2-(iw/zoom)/2+40*(on/$D)"; YEXPR="ih/2-(ih/zoom)/2";;       # in + pan
  esac
  ffmpeg -y -loglevel error -loop 1 -i "$seg" -filter_complex \
    "scale=1080:1920,zoompan=z='$ZEXPR':x='$XEXPR':y='$YEXPR':d=$D:s=1080x1920:fps=$FPS,format=yuv420p" \
    -t 4.5 -c:v libx264 -preset medium -crf 18 "seg$i.mp4"
  echo "  seg$i ok"
done

echo "[2/3] concatenado con xfade..."
ffmpeg -y -loglevel error \
  -i seg1.mp4 -i seg2.mp4 -i seg3.mp4 -i seg4.mp4 -i seg5.mp4 -i seg6.mp4 \
  -filter_complex "
  [0:v][1:v]xfade=transition=smoothleft:duration=$XF:offset=4.0[v1];
  [v1][2:v]xfade=transition=smoothup:duration=$XF:offset=8.0[v2];
  [v2][3:v]xfade=transition=circleopen:duration=$XF:offset=12.0[v3];
  [v3][4:v]xfade=transition=smoothleft:duration=$XF:offset=16.0[v4];
  [v4][5:v]xfade=transition=smoothup:duration=$XF:offset=20.0[v5]" \
  -map "[v5]" -c:v libx264 -preset medium -crf 18 -r 30 concat.mp4
echo "  concat ok ($(ffprobe -v error -show_entries format=duration -of csv=p=0 concat.mp4) s)"

echo "[3/3] mezcla con música..."
ffmpeg -y -loglevel error -i concat.mp4 -i musica.wav \
  -filter_complex "[1:a]afade=t=out:st=22.8:d=1.5,atrim=0:24.3[aud]" \
  -map 0:v -map "[aud]" -c:v copy -c:a aac -b:a 128k -movflags +faststart \
  reel-cumbre30.mp4
echo "REEL_OK: $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 reel-cumbre30.mp4)"
