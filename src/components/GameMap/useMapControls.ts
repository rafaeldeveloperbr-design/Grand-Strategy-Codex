import { useState, type RefObject } from 'react';
import { mapMetadata } from '../../data/map';

export function useMapControls(svgRef?: RefObject<SVGSVGElement>) {
  const [viewBox, setViewBox] = useState({ ...mapMetadata.initialViewBox });
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
    setViewBox({ ...mapMetadata.initialViewBox });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (isPanning) {
      const matrix = svgRef?.current?.getScreenCTM();
      if (!matrix) return;
      const inverse = matrix.inverse();
      const current = new DOMPoint(e.clientX, e.clientY).matrixTransform(inverse);
      const previous = new DOMPoint(panStart.x, panStart.y).matrixTransform(inverse);
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
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
