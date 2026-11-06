"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DanceSegment } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Rewind, FastForward, Maximize2 } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  selectedSegments: DanceSegment[]; // sorted by sort_order
}

export default function VideoPlayer({ videoUrl, selectedSegments }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // When selectedSegments changes, jump to the first segment's start
  useEffect(() => {
    const video = videoRef.current;
    if (!video || selectedSegments.length === 0) return;
    setCurrentSegmentIndex(0);
    video.currentTime = selectedSegments[0].start_time;
    if (isPlaying) video.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegments]);

  const jumpToSegment = useCallback((index: number) => {
    const video = videoRef.current;
    if (!video || selectedSegments.length === 0) return;
    const seg = selectedSegments[index];
    video.currentTime = seg.start_time;
    setCurrentSegmentIndex(index);
  }, [selectedSegments]);

  // Segment loop logic: called on every timeupdate
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || selectedSegments.length === 0) return;

    const seg = selectedSegments[currentSegmentIndex];
    setCurrentTime(video.currentTime);

    if (video.currentTime >= seg.end_time) {
      const nextIndex = (currentSegmentIndex + 1) % selectedSegments.length;
      const nextSeg = selectedSegments[nextIndex];

      if (nextIndex > currentSegmentIndex && nextSeg.start_time <= video.currentTime) {
        setCurrentSegmentIndex(nextIndex);
        return;
      }

      jumpToSegment(nextIndex);
    }
  }, [selectedSegments, currentSegmentIndex, jumpToSegment]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [handleTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (selectedSegments.length === 0) {
      // No segments selected – play normally
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
      return;
    }
    if (video.paused) {
      // Make sure we're within the current segment before playing
      const seg = selectedSegments[currentSegmentIndex];
      if (video.currentTime < seg.start_time || video.currentTime >= seg.end_time) {
        video.currentTime = seg.start_time;
      }
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    const video = videoRef.current;
    if (!video || selectedSegments.length === 0) return;
    jumpToSegment(0);
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Math.max(0, Math.min(video.duration || duration, video.currentTime + seconds));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await container.requestFullscreen?.().catch(() => undefined);
  };

  const handleVolumeChange = (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);

  const progressPercent =
    duration > 0 ? (currentTime / duration) * 100 : 0;

  const currentSegment =
    selectedSegments.length > 0 ? selectedSegments[currentSegmentIndex] : null;

  return (
    <div ref={containerRef} className="rounded-xl overflow-hidden bg-black">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          controls
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onEnded={handleVideoEnded}
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onVolumeChange={() => {
            const video = videoRef.current;
            if (!video) return;
            setVolume(video.volume);
            setIsMuted(video.muted);
          }}
          playsInline
        />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 px-4 py-3 space-y-2">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePlayPause}
              className="text-white hover:text-brand-400 transition-colors"
              title={isPlaying ? "Pausa" : "Spela"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-gray-400 hover:text-white transition-colors"
              title="Börja om från första valda del"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => seekBy(-10)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Spola tillbaka 10 sekunder"
            >
              <Rewind className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => seekBy(10)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Spola fram 10 sekunder"
            >
              <FastForward className="w-4 h-4" />
            </button>
            <span className="text-gray-400 text-xs tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleVolumeChange(isMuted ? 1 : 0)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isMuted ? "Slå på ljud" : "Stäng av ljud"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-24 accent-brand-500"
                aria-label="Volym"
              />
            </div>

            <button
              type="button"
              onClick={handleFullscreen}
              className="text-gray-400 hover:text-white transition-colors"
              title="Visa i storbild"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {currentSegment ? (
            <span className="text-xs text-brand-400 font-medium">
              {currentSegment.name}
              <span className="text-gray-500 ml-1">
                ({formatTime(currentSegment.start_time)}–{formatTime(currentSegment.end_time)})
              </span>
            </span>
          ) : (
            <span className="text-xs text-gray-500">Välj delar nedan för att loopa</span>
          )}
        </div>
      </div>
    </div>
  );
}
