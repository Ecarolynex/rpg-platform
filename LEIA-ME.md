# Frontend do Elementum — como integrar

## 1. Instalar dependência nova
Este frontend usa rotas. Se estiver integrando-o a um projeto que ainda não tem o React Router, instale:

```sh
npm install react-router-dom
```

## 2. Copiar os arquivos
Copie o conteúdo desta pasta para dentro do seu projeto `rpg-platform`, sobrescrevendo os seguintes arquivos do scaffold padrão:

- `index.html`
- `src/index.css`
- `src/main.tsx`
- `src/App.tsx`

Adicione também as pastas `src/components/`, `src/pages/`, `src/context/`, `src/types/`, `src/data/` e `src/services/`.

## 3. Arquivos que podem ser apagados
O scaffold não usa mais `src/App.css`, `src/assets/react.svg` nem `src/assets/vite.svg`. O `public/favicon.svg` e `public/icons.svg` podem ser mantidos.

## 4. Telas e recursos disponíveis
- **Login e cadastro** (`/entrar`, `/entra`) — autenticação pelo Supabase.
- **Personagens** (`/`) — carrega os personagens da conta, permite criar uma ficha, entrar em campanhas e excluir personagens.
- **Ficha do personagem** (`/personagem/:id`) — visualiza e edita identidade, atributos, perícias, vida, mana, carteira, classe, inventário, magias, história e notas.
- **Campanhas** (`/campanhas`) — cria campanhas ou permite entrar com código de convite.
- **Visão geral da campanha** (`/campanha/:id`) — personagens, regras e conteúdo da campanha, recursos do Mestre e distribuição de ouro.
- **Mapa da campanha** (`/campanha/:id/mapa`) — envia e visualiza mapas, com marcadores para Mestres e jogadores.
- **Loja da campanha** (`/campanha/:id/loja`) — loja e inventário da campanha.
- **Classes e habilidades** (`/regras/classes`) — mantém o catálogo global de classes, perícias, habilidades e magias.

### Interface da ficha

A ficha é renderizada dentro do `AppShell` e usa os dados carregados para o personagem da rota; a interface não substitui esses valores por conteúdo de demonstração. Sua organização é:

- Identificação no topo com nome, raça, classe e nível. O retrato é pequeno e secundário; pessoas com permissão podem enviá-lo ou trocá-lo.
- Perícias em uma lista à esquerda, com valores editáveis conforme as permissões do usuário.
- Brasão do Elementum no centro e cinco atributos em cartões circulares ao lado.
- Painéis inferiores para Vida e Mana, carteira/moedas e as seções de conteúdo.
- Abas **Classe**, **Inventário**, **Magias**, **História** e **Notas**. A navegação por teclado usa as setas, `Home` e `End`.

Vida, Mana e peças de ouro mantêm controles de ajuste rápido e salvamento. **Editar ficha completa** reúne os campos principais, e a foto pode ser trocada sem alterar os demais dados. Em campanhas, a ficha mantém links para a visão geral, o mapa e a loja.

### Identidade visual da ficha

A ficha usa a paleta global verde/teal escura e dourada do site. Fundo, painéis, texto e realces reutilizam os tokens `--ink`, `--ink-panel`, `--ink-panel-raised`, `--parchment`, `--parchment-dim`, `--gold` e `--gold-bright`, definidos em `src/index.css`. O retrato tem presença reduzida; o contorno dourado e a composição em zonas dão destaque à ficha.

## 5. Configurar o Supabase
A camada de dados em `src/services/api.ts` usa `src/services/supabase.ts`, que lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O mapa usa `src/lib/supabase.ts`, que lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Copie `.env.example` para `.env` e configure essas três variáveis com os dados do seu projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

Os dois clientes do frontend usam a mesma chave pública; mantenha `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY` com o mesmo valor. Use uma chave publicável/anon, nunca uma `service_role` ou outra chave secreta no frontend. Após criar ou alterar `.env`, reinicie o servidor Vite para carregar as variáveis.

## 6. Identidade visual do site
- Fontes: **Cinzel** para títulos, **Cormorant Garamond** para destaques e **EB Garamond** para texto. São carregadas em `src/index.css`.
- A paleta e os tokens globais estão em `src/index.css` (`:root`). Altere-os ali para atualizar o tema compartilhado.
- O nome **Elementum** aparece, entre outros locais, em `src/pages/Login/Login.tsx` e `src/components/layout/AppShell.tsx`.

## 7. Possíveis melhorias futuras
- Implementar um bestiário e recursos de rolagem de dados.
- Expandir as ferramentas de criação e gestão de campanhas.
