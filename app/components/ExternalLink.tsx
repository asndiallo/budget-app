export default function ExternalLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#4a8cff] hover:underline"
    >
      {label} ↗
    </a>
  );
}
