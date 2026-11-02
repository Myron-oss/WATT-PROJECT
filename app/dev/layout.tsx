import { notFound } from "next/navigation";

/** internal tools: not part of the public site */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
