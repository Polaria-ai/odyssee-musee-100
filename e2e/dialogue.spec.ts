import { expect, test } from '@playwright/test'
import { closeAnyDialogue, enterMuseum, gotoMusee, museeState, openPersonViaState, closePersonViaState } from './support/museeApi'

// Le texte de Rémi testé ici (accueil, tampons) est celui en français ; voir title-lang.spec.ts pour
// pourquoi la locale doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

// Depuis la V5 (chat avec Rémi · IA, `src/features/remiChat/`), l'accueil de Rémi n'est plus un dialogue
// scripté mais le chat, ouvert avec le même texte d'accueil déjà affiché. Le chat a sa propre spec
// (`remi-chat.spec.ts`) ; on vérifie ici l'accueil lui-même, et que les AUTRES dialogues (tampons,
// Archiviste) restent dans la bulle `dialogue-box`.

test('accueil de Rémi : le chat s’ouvre avec le texte d’accueil complet, instantané, et se ferme', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)

  const chat = page.getByTestId('remi-chat')
  await expect(chat).toBeVisible()
  const welcome = page.getByTestId('remi-chat-message').first()
  await expect(welcome).toHaveAttribute('data-role', 'assistant')
  await expect(welcome).toContainText('Rémi Godeau')

  // Plus de machine à écrire ni de tap pour avancer : les huit répliques de l'accueil sont toutes là.
  await expect(welcome).toContainText("Il s'inscrit dans la soirée")
  await expect(welcome).toContainText('Au sud du hall, une porte mène aux Archives de 2040')
  await expect(welcome).toContainText('revenez me voir quand vous le souhaitez')

  // Le dialogue scripté n'est plus utilisé pour l'accueil.
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0)
  expect((await museeState(page)).dialogue).toBeNull()

  await page.getByTestId('remi-chat-close').click()
  await expect(chat).toBeHidden()
  const state = await museeState(page)
  expect(state.remiChatOpen).toBe(false)
  expect(state.dialogue).toBeNull()
})

test('l’accueil peut être fermé au clavier (Échap)', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)

  const chat = page.getByTestId('remi-chat')
  await expect(chat).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(chat).toBeHidden()
})

test('les autres dialogues de Rémi (tampons) restent dans la bulle de dialogue', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await page.getByTestId('remi-chat-close').click()
  await expect(page.getByTestId('remi-chat')).toBeHidden()

  const state = await museeState(page)
  const wing = 'culture' as const
  const wingPeople = state.people.filter((p) => p.wing === wing).sort((a, b) => a.order - b.order)
  // requiredFor(total) = max(3, ceil(total * 0.3)) — voir src/features/stamps/stamps.ts.
  const required = Math.min(wingPeople.length, Math.max(3, Math.ceil(wingPeople.length * 0.3)))
  for (const person of wingPeople.slice(0, required)) await openPersonViaState(page, person.id)
  await closePersonViaState(page)

  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText('Rémi Godeau')
  await expect(page.getByTestId('remi-chat')).toBeHidden()

  // « Passer » ferme la bulle, comme avant.
  await page.getByRole('button', { name: 'Passer' }).click()
  await closeAnyDialogue(page)
  await expect(box).toBeHidden()
})
