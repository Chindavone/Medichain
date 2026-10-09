import { useEffect, useRef, useState } from "react";

// Accepts the book QR (MetaMask deep link or plain ?pid= link) or a bare book number.
export const pidFromText = (text) => text.match(/MC-\d{4}-\d{6}/i)?.[0].toUpperCase() ?? null;

/** Camera QR scanner. Calls onScan(pid) once a book QR is read, then stops the camera. */
export default function Scanner({ onScan, onClose }) {
  const dialog = useRef(null);
  const video = useRef(null);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState(null);

  useEffect(() => {
    dialog.current.showModal();
    let stream, frame, stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return setError("Browser ນີ້ເປີດກ້ອງບໍ່ໄດ້. ກ້ອງໃຊ້ໄດ້ສະເພາະຜ່ານ HTTPS — ໃສ່ເລກປຶ້ມເອງແທນ.");
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (e) {
        return setError(e.name === "NotAllowedError"
          ? "ບໍ່ໄດ້ຮັບອະນຸຍາດໃຊ້ກ້ອງ. ອະນຸຍາດກ້ອງໃນການຕັ້ງຄ່າ browser ແລ້ວລອງໃໝ່."
          : "ບໍ່ພົບກ້ອງໃນອຸປະກອນນີ້.");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const { default: jsQR } = await import("jsqr"); // loaded only when someone scans

      const tick = () => {
        if (stopped) return;
        const v = video.current;
        if (v.readyState >= 2 && v.videoWidth) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const pid = pidFromText(code.data);
            if (pid) { stopped = true; onScan(pid); return; }
            setHint("QR ນີ້ບໍ່ແມ່ນ QR ຂອງປຶ້ມ MediChain.");
          }
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <dialog ref={dialog} className="qr-dialog scanner" onCancel={onClose}>
      <h2>ສະແກນ QR ປຶ້ມຄົນເຈັບ</h2>
      {error ? <p className="notice deny">{error}</p> : (
        <div className="viewfinder">
          <video ref={video} playsInline muted />
          <span className="frame" aria-hidden="true" />
        </div>
      )}
      <p className="fine" role="status">{hint || "ສ່ອງກ້ອງໃສ່ QR ເທິງໜ້າປົກປຶ້ມຂອງຄົນເຈັບ."}</p>
      <button className="btn" onClick={onClose}>ປິດກ້ອງ</button>
    </dialog>
  );
}
