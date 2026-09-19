"use client";
import { useRef, useState } from "react";

export function OTPInput({
  onChange,
  disabled,
}: {
  onChange: (code: string) => void;
  disabled: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function update(next: string[], focus: number) {
    setDigits(next);
    onChange(next.join(""));
    inputs.current[Math.min(5, Math.max(0, focus))]?.focus();
  }
  function paste(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    if (clean)
      update(
        Array.from({ length: 6 }, (_, i) => clean[i] || ""),
        Math.min(clean.length, 5),
      );
  }
  return (
    <fieldset className="otp-fieldset" disabled={disabled}>
      <legend>Enter 6-digit verification code</legend>
      <div className="otp-digits">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            aria-label={`Verification digit ${index + 1}`}
            autoFocus={index === 0}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]"
            required
            value={digit}
            onFocus={(e) => e.currentTarget.select()}
            onPaste={(e) => {
              e.preventDefault();
              paste(e.clipboardData.getData("text"));
            }}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length > 1) {
                paste(value);
                return;
              }
              const next = [...digits];
              next[index] = value;
              update(next, value ? index + 1 : index);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                const next = [...digits];
                const target = digit ? index : Math.max(0, index - 1);
                next[target] = "";
                update(next, target);
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                inputs.current[
                  Math.min(
                    5,
                    Math.max(0, index + (e.key === "ArrowRight" ? 1 : -1)),
                  )
                ]?.focus();
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
