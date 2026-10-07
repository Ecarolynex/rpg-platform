import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DiceRoller } from "./DiceRoller";
import type { RollHistoryStore } from "./diceRoller.types";

function createHistoryStore(): RollHistoryStore {
  const history = new Map<string, ReturnType<RollHistoryStore["load"]>>();
  return {
    load: vi.fn((campaignId) => history.get(campaignId) ?? []),
    save: vi.fn((campaignId, rolls) => history.set(campaignId, rolls)),
  };
}

describe("DiceRoller", () => {
  it("seleciona dado, aceita modificador negativo e registra uma falha crítica natural", async () => {
    const historyStore = createHistoryStore();
    const onModifierChange = vi.fn();
    const props = {
      campaignId: "campaign-1",
      modifierValue: "0",
      onModifierChange,
      historyStore,
      randomSource: () => 0,
      animationDurationMs: 0,
    };
    const view = render(
      <MemoryRouter>
        <DiceRoller {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "d20, Dado de 20 lados, resultados 1 a 20" }));
    expect(screen.getByRole("button", { name: "d20, Dado de 20 lados, resultados 1 a 20" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Modificador"), {
      target: { value: "-1" },
    });
    expect(onModifierChange).toHaveBeenCalledWith("-1");
    view.rerender(
      <MemoryRouter>
        <DiceRoller {...props} modifierValue="-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rolar d20" }));

    expect(await screen.findAllByText("Falha crítica")).toHaveLength(2);
    expect(screen.getByText("Dado: d20 | Rolado: 1 | Modificador: -1 | Total: 0")).toBeInTheDocument();
    expect(screen.getByRole("status").querySelector(".dice-result-mark span")).toBeNull();
    await waitFor(() => {
      expect(historyStore.save).toHaveBeenCalledWith(
        "campaign-1",
        expect.arrayContaining([
          expect.objectContaining({ die: 20, natural: 1, modifier: -1, total: 0, critical: "failure" }),
        ]),
      );
    });
  });

  it("oferece os sete dados padrão", () => {
    render(
      <MemoryRouter>
        <DiceRoller
          campaignId="campaign-1"
          modifierValue="0"
          onModifierChange={vi.fn()}
          historyStore={createHistoryStore()}
          animationDurationMs={0}
        />
      </MemoryRouter>,
    );

    const dice = [
      ["d4", "Dado de 4 lados, resultados 1 a 4"],
      ["d6", "Dado de 6 lados, resultados 1 a 6"],
      ["d8", "Dado de 8 lados, resultados 1 a 8"],
      ["d10", "Dado de 10 lados, resultados 1 a 10"],
      ["d12", "Dado de 12 lados, resultados 1 a 12"],
      ["d20", "Dado de 20 lados, resultados 1 a 20"],
      ["d100", "Dado de 100 lados, resultados 10, 20, 30 … 100"],
    ];

    for (const [name, model] of dice) {
      expect(screen.getByRole("button", { name: `${name}, ${model}` })).toBeInTheDocument();
    }

    expect(screen.getByText("100 lados · 10, 20, 30 … 100")).toBeInTheDocument();
  });
});
