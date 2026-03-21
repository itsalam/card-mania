import { CollectionItem } from '@/client/collections/types'

export type CartItem = {
  data: CollectionItem
  cart: {
    price: number
    quantity: number
    maxQuantity: number
  }
}
