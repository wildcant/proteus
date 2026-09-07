export type WalletChoice = {
  /** Whether the shopper asked to keep the card they are paying with. */
  savePaymentMethod: boolean
  /** The stored card they picked, if they picked one. */
  paymentMethodId: string | undefined
}

/**
 * What the shopper said about their wallet, read from the adapter's own `data` blob.
 *
 * Two values, both the shopper's to give: whether to keep the card, and which stored card they
 * picked. Neither is trusted further than its shape — the account holder they act against is
 * resolved by the caller from its own authentication, never from anything on the wire.
 */
export function readWalletChoice(data: Record<string, unknown> | undefined): WalletChoice {
  const chosenMethodId = data?.paymentMethodId

  return {
    savePaymentMethod: data?.savePaymentMethod === true,
    paymentMethodId: typeof chosenMethodId === 'string' && chosenMethodId !== '' ? chosenMethodId : undefined,
  }
}
