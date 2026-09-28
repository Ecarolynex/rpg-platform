import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

describe('Dashboard', () => {
  it('exibe a ficha de criação de novo personagem com os campos principais de história', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: /\+ novo personagem/i });
    trigger.click();

    expect(screen.getByText(/escolha uma ficha para continuar sua jornada/i)).toBeInTheDocument();

    const formHeading = await screen.findByRole('heading', { name: /criação de personagem/i });
    expect(formHeading).toBeInTheDocument();
    expect(screen.getByLabelText(/nome do personagem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/raça/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/classe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/história do personagem/i)).toBeInTheDocument();
  });
});
