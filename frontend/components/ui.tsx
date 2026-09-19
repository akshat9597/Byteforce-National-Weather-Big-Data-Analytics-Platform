"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge badge-" + value.toLowerCase().replaceAll(" ", "-")}>
      <i />
      {value}
    </span>
  );
}
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer">
          <header>
            <div>
              <span className="eyebrow">BYTEFORCE INTELLIGENCE</span>
              <Dialog.Title>{title}</Dialog.Title>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close details">
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">
            Record details, evidence and available actions.
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  text = "No reports found for selected filters.",
}: {
  text?: string;
}) {
  return <div className="empty">{text}</div>;
}
export const fmt = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
