import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CharacterSheet from './CharacterSheet';

describe('CharacterSheet - Ficha de Personagem', () => {
  it('renderiza o personagem com sucesso e exibe PV temporários', async () => {
    render(
      <MemoryRouter initialEntries={['/personagem/1']}>
        <Routes>
          <Route path="/personagem/:id" element={<CharacterSheet />} />
        </Routes>
      </MemoryRouter>
    );

    const nameHeading = await screen.findByRole('heading', { name: /bram ferroz/i });
    expect(nameHeading).toBeInTheDocument();

    // Verifica a presença do controle de PV Temporários
    expect(screen.getByText(/pv temporários/i)).toBeInTheDocument();
  });

  it('permite adicionar itens e equipamentos no inventário', async () => {
    render(
      <MemoryRouter initialEntries={['/personagem/1']}>
        <Routes>
          <Route path="/personagem/:id" element={<CharacterSheet />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /bram ferroz/i });

    // Clica na aba Inventário
    fireEvent.click(screen.getByRole('button', { name: /inventário/i }));

    // Clica no botão de adicionar item
    fireEvent.click(screen.getByRole('button', { name: /\+ adicionar item \/ equipamento/i }));

    // Preenche os campos do item
    const nameInput = screen.getByPlaceholderText(/espada longa élfica/i);
    fireEvent.change(nameInput, { target: { value: 'Escudo de Carvalho' } });

    // Salva o item
    fireEvent.click(screen.getByRole('button', { name: /salvar item/i }));

    expect(screen.getByText('Escudo de Carvalho')).toBeInTheDocument();
  });

  it('permite adicionar habilidades e magias', async () => {
    render(
      <MemoryRouter initialEntries={['/personagem/1']}>
        <Routes>
          <Route path="/personagem/:id" element={<CharacterSheet />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /bram ferroz/i });

    // Clica na aba Habilidades
    fireEvent.click(screen.getByRole('button', { name: /habilidades/i }));

    // Clica para adicionar habilidade
    fireEvent.click(screen.getByRole('button', { name: /\+ adicionar habilidade \/ magia/i }));

    const spellInput = screen.getByPlaceholderText(/golpe certeiro/i);
    fireEvent.change(spellInput, { target: { value: 'Golpe Destruidor' } });

    const descInput = screen.getByPlaceholderText(/descreva o que a habilidade faz/i);
    fireEvent.change(descInput, { target: { value: 'Causa 2d8 de dano adicional' } });

    fireEvent.click(screen.getByRole('button', { name: /salvar habilidade/i }));

    expect(screen.getByText('Golpe Destruidor')).toBeInTheDocument();
  });

  it('exibe mensagem quando o personagem não existe, sem looping infinito', async () => {
    render(
      <MemoryRouter initialEntries={['/personagem/id-inexistente-12345']}>
        <Routes>
          <Route path="/personagem/:id" element={<CharacterSheet />} />
        </Routes>
      </MemoryRouter>
    );

    const notFoundHeading = await screen.findByRole('heading', { name: /personagem não encontrado/i }, { timeout: 3000 });
    expect(notFoundHeading).toBeInTheDocument();
  });
});
