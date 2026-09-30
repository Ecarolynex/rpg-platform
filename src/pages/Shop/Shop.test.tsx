import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Shop from './Shop';

vi.mock('../../services/api', () => ({
  getCharacters: vi.fn().mockResolvedValue([
    {
      id: 'char-1',
      nome: 'Aventureiro Teste',
      raca: 'Humano',
      classe: 'Guerreiro',
      nivel: 3,
      hp: { atual: 30, max: 30 },
      mp: { atual: 10, max: 10 },
      attributes: { forca: 16, destreza: 14, constituicao: 15, inteligencia: 10, sabedoria: 12, carisma: 8 },
      skills: [],
      inventory: [],
      spells: [],
      carteira: { pc: 0, pp: 0, pe: 0, po: 1250, pl: 0 },
      notas: '',
    },
  ]),
  getCampaignAccess: vi.fn().mockResolvedValue({ isMaster: true, startingGold: 1250 }),
  listarMinhasCampanhas: vi.fn().mockResolvedValue([{
    id: 'campanha-teste',
    nome: 'Crônicas de Elementum',
    descricao: null,
    sistema: 'Elementum RPG',
    imagem_url: null,
    moeda_principal: 'Ouro',
    ouro_inicial: 1250,
    status: 'ATIVA',
    codigo_convite: 'ABC123',
    created_by: 'mestre-teste',
    created_at: '2026-09-29T00:00:00.000Z',
  }]),
  listarItensDaLoja: vi.fn().mockResolvedValue([
    {
      id: 'item-1',
      campanhaId: 'teste',
      itemId: 'item-base-1',
      nome: 'Espada do Crepúsculo',
      descricao: 'Uma lâmina de aço escurecido forjada sob luas gêmeas.',
      tipo: 'ARMA',
      raridade: 'RARO',
      efeito: '+2 em testes de ataque com pouca luz',
      imagemUrl: '',
      precoCompra: 250,
      precoVenda: 125,
      estoque: 3,
      ativo: true,
      vendaPermitida: true,
    },
    {
      id: 'item-2',
      campanhaId: 'teste',
      itemId: 'item-base-2',
      nome: 'Poção de Cura',
      descricao: 'Líquido vermelho brilhante com cheiro adocicado.',
      tipo: 'CONSUMIVEL',
      raridade: 'COMUM',
      efeito: 'Recupera 2d4 + 2 pontos de vida',
      imagemUrl: '',
      precoCompra: 50,
      precoVenda: 25,
      estoque: 10,
      ativo: true,
      vendaPermitida: true,
    },
    {
      id: 'item-3',
      campanhaId: 'teste',
      itemId: 'item-base-3',
      nome: 'Amuleto do Pescador',
      descricao: 'Um amuleto esculpido em madrepérola.',
      tipo: 'ACESSORIO',
      raridade: 'INCOMUM',
      efeito: 'Vantagem em testes de Sobrevivência na água',
      imagemUrl: '',
      precoCompra: 180,
      precoVenda: 90,
      estoque: 5,
      ativo: true,
      vendaPermitida: true,
    },
  ]),
  comprarItem: vi.fn().mockResolvedValue({ id: 'compra-1' }),
}));

describe('Shop', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exibe a Loja e os itens do catálogo', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Loja' })).toBeInTheDocument();
    expect(screen.getAllByText('Loja')).toHaveLength(1);
    const headerActions = screen.getByRole('banner').querySelector('.shop-header-actions');
    expect(headerActions?.firstElementChild).toHaveClass('shop-wallet');
    expect(headerActions?.lastElementChild).toHaveClass('shop-cart-link');
    expect(screen.getAllByText(/espada do crepúsculo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/poção de cura/i).length).toBeGreaterThan(0);
  });

  it('publica uma carta com PNG enviada pelo mestre', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /adicionar carta/i }));

    const imageInput = screen.getByLabelText(/imagem da carta \(png\)/i);
    expect(imageInput).toHaveAttribute('type', 'file');
    expect(imageInput).toHaveAttribute('accept', 'image/png');

    fireEvent.change(screen.getByLabelText('Nome da carta'), { target: { value: 'Carta com arte' } });
    fireEvent.change(screen.getByLabelText('Subcategoria'), { target: { value: 'Relíquias' } });
    fireEvent.change(screen.getByLabelText('Preço em PO'), { target: { value: '325' } });
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Carta de teste com ilustração.' } });
    fireEvent.change(imageInput, {
      target: { files: [new File(['png-data'], 'carta.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('img', { name: 'Prévia da carta' })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('heading', { name: 'Nova carta da loja' }).closest('form')!);
    expect(await screen.findByRole('img', { name: 'Carta com arte' })).toBeInTheDocument();
    const createdCard = screen.getByRole('article', { name: 'Carta com arte' });
    expect(within(createdCard).getByText('325 PO')).toBeInTheDocument();
    expect(within(createdCard).getByText('4 em estoque')).toBeInTheDocument();
  });

  it('mostra as ações de administração abaixo do painel e permite editar cartas', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    const adminHeading = await screen.findByRole('heading', { name: 'Administrar loja' });
    const activeCharacter = screen.getByText('Personagem ativo');
    expect(adminHeading.compareDocumentPosition(activeCharacter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(screen.getByRole('heading', { name: 'Editar carta da loja' })).toBeInTheDocument();
    expect(screen.getByLabelText(/imagem da carta \(png\)/i)).toHaveAttribute('accept', 'image/png');
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome da carta'), { target: { value: 'Carta revisada' } });
    fireEvent.change(screen.getByLabelText('Preço em PO'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByRole('heading', { name: 'Carta revisada' })).toBeInTheDocument();
    const revisedCard = screen.getByRole('article', { name: 'Carta revisada' });
    expect(within(revisedCard).getByText('999 PO')).toBeInTheDocument();
  });

  it('não exibe a administração para um jogador', async () => {
    const { getCampaignAccess } = await import('../../services/api');
    vi.mocked(getCampaignAccess).mockResolvedValueOnce({ isMaster: false, startingGold: 500 });

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Personagem ativo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administrar loja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('seleciona uma campanha na aba Loja antes de mostrar seus itens', async () => {
    render(
      <MemoryRouter initialEntries={['/loja']}>
        <Routes>
          <Route path="/loja" element={<Shop />} />
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('link', { name: /crônicas de elementum/i }));
    expect(await screen.findByRole('heading', { name: 'Administrar loja' })).toBeInTheDocument();
  });

  it('exibe a imagem da carta dentro do modal de exame', async () => {
    window.localStorage.setItem('rpg-platform-shop-teste', JSON.stringify([{
      id: 'carta-ilustrada',
      campaignId: 'teste',
      nome: 'Carta ilustrada',
      categoria: 'Armas',
      subcategoria: 'Espadas',
      raridade: 'Raro',
      descricao: 'Uma lâmina encantada.',
      efeitos: ['+2 Força'],
      preco: 300,
      moeda: 'PO',
      estoque: 2,
      disponivel: true,
      imagem: 'data:image/png;base64,aW1hZ2U=',
    }]));

    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Examinar' }));

    const modal = screen.getByRole('heading', { level: 2, name: 'Carta ilustrada' }).closest('.shop-modal');
    expect(modal).not.toBeNull();
    expect(within(modal as HTMLElement).getByRole('img', { name: 'Carta ilustrada' })).toHaveAttribute(
      'src',
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(within(modal as HTMLElement).getByText('Uma lâmina encantada.')).toBeInTheDocument();
  });

  it('leva ao carrinho, atualiza quantidades e finaliza a compra', async () => {
    render(
      <MemoryRouter initialEntries={['/campanha/teste/loja']}>
        <Routes>
          <Route path="/campanha/:id/loja" element={<Shop />} />
          <Route path="/campanha/:id/loja/carrinho" element={<Shop />} />
        </Routes>
      </MemoryRouter>,
    );

    const amuletCard = await screen.findByRole('article', { name: 'Amuleto do Pescador' });
    fireEvent.click(within(amuletCard).getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Carrinho 1' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Carrinho' })).toBeInTheDocument();
    const cartEntry = screen.getByRole('article', { name: /Amuleto do Pescador/ });
    fireEvent.click(within(cartEntry).getByRole('button', { name: 'Aumentar Amuleto do Pescador' }));
    expect(within(cartEntry).getByText('360 PO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar compra' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/compra concluída/i);
    expect(screen.getByText('890 PO')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sua sacola está vazia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar a loja' })).toHaveClass('shop-empty-action');
  });
});
