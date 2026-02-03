import { useDeleteCollection } from '@/client/collections/mutate'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Text } from '@/components/ui/text'
import { Delete, Trash } from 'lucide-react-native'
import { View } from 'react-native'
import { Colors, Toast } from 'react-native-ui-lib'
import { useCollectionsPageStore } from '../provider'
export const DeleteModal = ({
  showDeleteModal,
  setShowDeleteModal,
  collectionId,
}: {
  collectionId?: string
  showDeleteModal: boolean
  setShowDeleteModal: (s: boolean) => void
}) => {
  const { setCurrentPage, preferenceState } = useCollectionsPageStore()
  const deleteMutate = useDeleteCollection()

  const { showToast } = useToast()

  const handleDelete = () => {
    collectionId &&
      deleteMutate.mutateAsync(collectionId).then(() => {
        setShowDeleteModal(false)
        setCurrentPage('default')
        preferenceState.updatePreferences({
          tabs: preferenceState.preferences.tabs?.filter((tab) => tab !== collectionId),
        })
        setTimeout(
          () =>
            showToast({
              title: 'Collection deleted',
              message: 'Collection succesfully deleted',
              icon: Trash,
              textColor: Colors.$textDanger,
            }),
          100
        )
      })
  }

  return (
    <>
      <Toast visible={showToast} message="Collection Deleted" position="bottom" />
      <Modal visible={showDeleteModal} onDismiss={() => setShowDeleteModal(false)}>
        <View style={{ flexDirection: 'column', gap: 8 }}>
          <Text variant={'large'}>Delete this collection? This cannot be undone. </Text>
          <Button variant={'destructive'} style={{ height: 44 }} onPress={() => handleDelete()}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignContent: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Delete size={32} color={Colors.$iconDefaultLight} />
              <Text variant={'large'} style={{ color: Colors.$textDefaultLight, fontSize: 20 }}>
                Delete
              </Text>
            </View>
          </Button>
        </View>
      </Modal>
    </>
  )
}
