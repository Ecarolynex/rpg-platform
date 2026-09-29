import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { CLASSES, RACES, AFFILIATIONS, FIXED_SKILLS } from '../../data/personaRules';

describe('Dashboard e Criação de Persona', () => {
  it('exibe o formulário de criação de personagem ao clicar no botão', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /\+ novo personagem/i });
    fireEvent.click(trigger);

    expect(screen.getByText(/escolha uma ficha para continuar sua jornada/i)).toBeInTheDocument();
    const formHeading = await screen.findByRole('heading', { name: /criação de personagem/i });
    expect(formHeading).toBeInTheDocument();
  });

  it('exibe os menus selecionáveis (dropdowns) de Classe, Raça e Filiação com as opções corretas', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ novo personagem/i }));

    const selectClasse = screen.getByLabelText(/classe/i) as HTMLSelectElement;
    expect(selectClasse).toBeInTheDocument();
    CLASSES.forEach((cls) => {
      expect(screen.getByRole('option', { name: cls })).toBeInTheDocument();
    });

    const selectRaca = screen.getByLabelText(/raça/i) as HTMLSelectElement;
    expect(selectRaca).toBeInTheDocument();
    RACES.forEach((race) => {
      expect(screen.getByRole('option', { name: race })).toBeInTheDocument();
    });

    const selectFiliacao = screen.getByLabelText(/filiação/i) as HTMLSelectElement;
    expect(selectFiliacao).toBeInTheDocument();
    AFFILIATIONS.forEach((aff) => {
      expect(screen.getByRole('option', { name: aff })).toBeInTheDocument();
    });
  });

  it('exibe campos de Altura numérico, Pontos de Mana (PM), Traços de Personalidade, Defeitos e NÃO exibe campo Objetivo', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ novo personagem/i }));

    expect(screen.getByLabelText(/altura/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pontos de mana/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/traços de personalidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/defeitos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/aparência descritiva/i)).toBeInTheDocument();

    // Regra: "Remover completamente o campo Objetivo"
    expect(screen.queryByLabelText(/objetivo/i)).not.toBeInTheDocument();
  });

  it('exibe os 5 atributos base (FOR, DES, CON, INT, CAR) e seus bônus calculados embaixo', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ novo personagem/i }));

    expect(screen.getByText('Força')).toBeInTheDocument();
    expect(screen.getByText('Destreza')).toBeInTheDocument();
    expect(screen.getByText('Constituição')).toBeInTheDocument();
    expect(screen.getByText('Inteligência')).toBeInTheDocument();
    expect(screen.getByText('Carisma')).toBeInTheDocument();
    expect(screen.queryByText('Sabedoria')).not.toBeInTheDocument();
    expect(screen.getAllByText('FOR').length).toBeGreaterThanOrEqual(1);
  });

  it('exibe a lista das 11 perícias e limita a seleção a no máximo 2 perícias treinadas', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ novo personagem/i }));

    // Verifica que todas as 11 perícias são exibidas
    FIXED_SKILLS.forEach((skill) => {
      expect(screen.getByText(skill.nome)).toBeInTheDocument();
    });

    // Checkboxes das perícias
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(11);

    // Initial draft tem 2 perícias selecionadas (atletismo e intimidação)
    const checked = checkboxes.filter((cb) => (cb as HTMLInputElement).checked);
    expect(checked.length).toBe(2);

    // As restantes devem estar desabilitadas pois o limite máximo é 2
    const disabled = checkboxes.filter((cb) => (cb as HTMLInputElement).disabled);
    expect(disabled.length).toBe(9);

    // Se desmarcar uma, uma vaga abre e as demais são habilitadas
    fireEvent.click(checked[0]);
    const disabledAfterUncheck = checkboxes.filter((cb) => (cb as HTMLInputElement).disabled);
    expect(disabledAfterUncheck.length).toBe(0);
  });
});
