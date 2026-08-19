import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NumberField, { parseFieldValue } from "@/components/ui/NumberField";

// A parent that behaves like the real ones: it owns the number and feeds it
// straight back down, which is what makes the draft/echo handling load-bearing.
function Harness({ initial = 0, onValue }: { initial?: number; onValue?: (v: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      label="Lumpsum"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe("parseFieldValue", () => {
  it("returns NaN for an empty box rather than a silent zero", () => {
    expect(parseFieldValue("")).toBeNaN();
    expect(parseFieldValue("   ")).toBeNaN();
  });

  it("returns NaN for a half-typed value", () => {
    expect(parseFieldValue("-")).toBeNaN();
    expect(parseFieldValue("abc")).toBeNaN();
  });

  it("parses ordinary numbers, negatives and decimals included", () => {
    expect(parseFieldValue("1000")).toBe(1000);
    expect(parseFieldValue("-2.5")).toBe(-2.5);
  });
});

describe("NumberField", () => {
  it("lets the box sit empty instead of snapping back to 0", () => {
    const onValue = vi.fn();
    render(<Harness initial={5000} onValue={onValue} />);
    const input = screen.getByLabelText("Lumpsum") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "" } });

    expect(input.value).toBe("");
    expect(onValue).toHaveBeenCalledWith(NaN);
  });

  // The old implementation emitted Number("") === 0 here, so backspacing a
  // field wrote a real 0 into the projections without the user typing one.
  it("does not report an emptied field as zero", () => {
    const onValue = vi.fn();
    render(<Harness initial={5000} onValue={onValue} />);
    fireEvent.change(screen.getByLabelText("Lumpsum"), { target: { value: "" } });
    expect(onValue).not.toHaveBeenCalledWith(0);
  });

  it("keeps a trailing zero while a decimal is still being typed", () => {
    render(<Harness initial={1} />);
    const input = screen.getByLabelText("Lumpsum") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.change(input, { target: { value: "1.50" } });
    // Echoing the parsed 1.5 back down must not rewrite the box to "1.5"
    // under the cursor.
    expect(input.value).toBe("1.50");
  });

  it("adopts a value changed from outside, e.g. a loaded scenario", () => {
    function ExternalHarness() {
      const [value, setValue] = useState(10);
      return (
        <>
          <NumberField label="Lumpsum" value={value} onChange={setValue} />
          <button onClick={() => setValue(999)}>load</button>
        </>
      );
    }
    render(<ExternalHarness />);
    const input = screen.getByLabelText("Lumpsum") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    expect(input.value).toBe("999");
  });

  it("wires an error message to the input for assistive tech", () => {
    render(
      <NumberField label="Lumpsum" value={-1} error="Must be at least 0." onChange={() => {}} />,
    );
    const input = screen.getByLabelText("Lumpsum");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Must be at least 0.");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("renders no error affordance when the value is fine", () => {
    render(<NumberField label="Lumpsum" value={10} onChange={() => {}} />);
    expect(screen.getByLabelText("Lumpsum")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("publishes its bounds to the browser's own constraint UI", () => {
    render(<NumberField label="Lumpsum" value={10} min={0} max={100} onChange={() => {}} />);
    const input = screen.getByLabelText("Lumpsum");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
  });
});
