import { useEffect, useState, useRef } from "react";

export default function useBirdSocket(url = "wss://avianear.onrender.com/ws") {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("disconnected");
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let mediaRecorder;
    let stream;

    const connect = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus("connected");
          console.log("Connected");

          // Record in 5-second complete clips
          const record = () => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const chunks = [];
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
              if (ws.readyState === WebSocket.OPEN && chunks.length > 0) {
                const blob = new Blob(chunks, { type: "audio/webm" });
                const buffer = await blob.arrayBuffer();
                ws.send(buffer);
                console.log("Sent complete clip:", buffer.byteLength, "bytes");
              }
              // Record next clip
              setTimeout(record, 100);
            };

            mediaRecorder.start();
            setTimeout(() => {
              if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
              }
            }, 5000);
          };

          record();
        };

        ws.onclose = () => {
          setStatus("disconnected");
          if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        };

        ws.onerror = (e) => console.error("WS error:", e);

        ws.onmessage = (event) => {
          const incoming = JSON.parse(event.data);
          if (incoming.type === "detection") {
            setData((prev) => [
              ...prev,
              {
                species: incoming.common_name,
                confidence: incoming.confidence / 100,
                time: incoming.timestamp,
              },
            ]);
          }
        };

      } catch (err) {
        console.error("Mic error:", err);
        setStatus("mic_denied");
      }
    };

    connect();

    return () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (ws) ws.close();
    };
  }, [url]);

  return { data, status };
}