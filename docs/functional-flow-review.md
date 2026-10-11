# Revisão dos fluxos funcionais Mestre/Jogador

## Escopo

Revisão estática do roteiro recebido para Dashboard → campanhas → jogadores/personagens → classes → mapa → loja/inventário → recompensas → retorno e sessão. A revisão do código foi complementada por testes de frontend; ela não comprova que as migrations novas foram aplicadas ou que os controles RLS correspondem ao staging.

## Corrigido nesta rodada

- **Criação da campanha:** passou a usar `criar_campanha_atomica`; campanha, associação do Mestre e registro da chave idempotente são gravados na mesma transação. Uma repetição com a mesma chave retorna a campanha criada em vez de duplicar.
- **Recompensas do Mestre:** Ouro, XP e itens entregues diretamente aceitam personagem ou grupo. O backend valida Mestre ativo e personagem na campanha, bloqueia duplicação usando `request_id` e registra o resultado em `campanha_recompensas`. XP relacional agora aparece na ficha, cartões e seleção do destinatário.
- **Ficha e recursos:** conflitos no autosave deixam de repetir snapshots obsoletos; fica disponível recarregar a versão do servidor descartando alterações pendentes. O cliente carrega máximos do servidor e, para personagens editáveis, executa a reconciliação/clamp antes de permitir alteração de recursos.
- **Classe e equipamento:** a descrição de classe segue a precedência da regra efetiva e mostra nível em habilidades da campanha. O resumo da campanha recebe bônus de equipamento e PV/PM via RPC do servidor, em vez de confiar apenas no cálculo local.
- **Mapa:** cliente verifica participação ativa, filtra marcadores invisíveis e a migration proposta acrescenta regras RLS para leitura, posicionamento e exclusão de marcadores.
- **Navegação/sessão:** erro de logout agora fica visível; a lista de campanhas exibe o ouro inicial configurado.

## Lacunas do roteiro que continuam abertas

1. **Gerenciamento de participantes:** não há fluxo verificado de expulsão/saída, reativação administrativa ou confirmação do que acontece com personagem e inventário ao remover um membro. O comportamento precisa de regra de produto antes de ser implementado.
2. **Venda/devolução:** loja e RPC cobrem compra atômica, estoque e saldo; não foi encontrado um fluxo de jogador vender/devolver item nem uma política aprovada de preço/quantidade para reembolso.
3. **Validação operacional:** criação transacional, recompensas idempotentes, RLS de marcadores e autoridade de PV/PM dependem das migrations `202610100003`–`202610100006`; não foram executadas em staging nesta sessão.
4. **Resumo de máximos:** o resumo usa o endpoint autoritativo do banco, mas faz fallback para cálculo local se essa consulta falhar; a interface registra o erro de equipamento. Não promova sem exercitar o cenário com falha de rede e RLS em staging.

## Verificação local

Build/typecheck, lint e testes automatizados foram executados após as correções. Não houve chamadas autenticadas ao Supabase nem validação SQL contra banco conectado.
