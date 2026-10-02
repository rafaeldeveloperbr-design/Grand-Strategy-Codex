import { useState } from 'react';

export function useMapControls() {
  const [viewBox, setViewBox] = useState({ x: -20, y: 20, w: 840, h: 640 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setViewBox((prev) => ({
      x: prev.x + prev.w * 0.1,
      y: prev.y + prev.h * 0.1,
      w: prev.w * 0.8,
      h: prev.h * 0.8,
    }));
  };

  const handleZoomOut = () => {
    setViewBox((prev) => ({
      x: prev.x - prev.w * 0.125,
      y: prev.y - prev.h * 0.125,
      w: prev.w * 1.25,
      h: prev.h * 1.25,
    }));
  };

  const handleResetZoom = () => {
    setViewBox({ x: -20, y: 20, w: 840, h: 640 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panStart.x) * (viewBox.w / 800);
      const dy = (e.clientY - panStart.y) * (viewBox.h / 600);
      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return {
    viewBox,
    isPanning,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMouseDown,
    handleMouseMovePan,
    handleMouseUp,
  };
}