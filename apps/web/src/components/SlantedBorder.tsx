/** 彈窗／看板標題下方虛線分隔（全站 popup 共用） */
export const FRAME_LINE_SRC = "/assets/upload-gen-page/pic_genAI_frame_line.png";

export default function SlantedBorder({ className = "" }: { className?: string }) {
  return (
    <img
      src={FRAME_LINE_SRC}
      alt=""
      className={`mx-auto block w-full max-w-[280px] object-contain ${className}`}
      aria-hidden
    />
  );
}
