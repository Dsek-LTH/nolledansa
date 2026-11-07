export interface MediaStream {
  index: number;
  codec_type: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  profile?: string;
  disposition?: { attached_pic?: number };
}

export interface MediaInfo {
  format: { format_name?: string; tags?: { major_brand?: string } };
  streams: MediaStream[];
}

export function videoPlan(info: MediaInfo) {
  const video = info.streams.find(s => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video) throw new Error("Filen saknar ett videospår.");
  const audio = info.streams.find(s => s.codec_type === "audio");
  const copyVideo = video.codec_name === "h264" && ["yuv420p", "yuvj420p"].includes(video.pix_fmt ?? "");
  const copyAudio = !audio || (audio.codec_name === "aac" && audio.profile === "LC");
  const mp4 = (info.format.format_name?.split(",").includes("mp4") ?? false)
    && info.format.tags?.major_brand?.trim() !== "qt";
  return { video, audio, copyVideo, copyAudio, unchanged: mp4 && copyVideo && copyAudio };
}
