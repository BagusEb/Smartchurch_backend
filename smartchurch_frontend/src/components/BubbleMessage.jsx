export default function BubbleMessage({ avatar, content, alignment, avatarClass, bubbleClass }) {
  return (
  <div
    className={`flex max-w-[88%] min-w-0 gap-2.5 ${
      alignment === "right" ? "self-end flex-row-reverse" : "self-start"
    }`}
  >
    <div
      className={`mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ${avatarClass}`}
    >
      {avatar}
    </div>

    {/* Message bubble */}
    <div
      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed min-w-0 max-w-full ${bubbleClass}`}
    >
      {content}
    </div>
  </div>
);
}