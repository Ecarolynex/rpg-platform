import { useState } from "react";

const OUTRA = "__outra__";

type OptionFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  wide?: boolean;
};

export function OptionField({
  label,
  value,
  options,
  onChange,
  wide,
}: OptionFieldProps) {
  const valorPersonalizado = value !== "" && !options.includes(value);
  const [outra, setOutra] = useState(valorPersonalizado);
  const mostrarCampo = outra || valorPersonalizado;

  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}</span>

      <select
        value={mostrarCampo ? OUTRA : value}
        onChange={(event) => {
          if (event.target.value === OUTRA) {
            setOutra(true);
            onChange("");
          } else {
            setOutra(false);
            onChange(event.target.value);
          }
        }}
      >
        <option value="">Selecione...</option>

        {options.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}

        <option value={OUTRA}>Outro...</option>
      </select>

      {mostrarCampo && (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Digite aqui..."
        />
      )}
    </label>
  );
}
