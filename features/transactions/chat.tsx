import { useSendTransactionMessage, useTransactionMessages } from '@/client/transactions/messages'
import { TransactionMessage } from '@/client/transactions/types'
import { Text } from '@/components/ui/text/base-text'
import { useProfiles } from '@/features/users/client/load-user'
import { UserAvatar } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { SendHorizonal } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMessageTime(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Single message bubble ─────────────────────────────────────────────────────

function ChatMessage({
  message,
  isMine,
  otherUser,
  showAvatar,
}: {
  message: TransactionMessage
  isMine: boolean
  otherUser: UserDisplayInfo | undefined
  showAvatar: boolean
}) {
  return (
    <View style={[msgStyles.row, isMine ? msgStyles.rowMine : msgStyles.rowTheirs]}>
      {!isMine && (
        <View style={msgStyles.avatarSlot}>
          {showAvatar && <UserAvatar user={otherUser} size="sm" />}
        </View>
      )}
      <View style={msgStyles.bubbleWrapper}>
        <View style={[msgStyles.bubble, isMine ? msgStyles.bubbleMine : msgStyles.bubbleTheirs]}>
          <Text variant="default" style={[msgStyles.content, isMine && msgStyles.contentMine]}>
            {message.content}
          </Text>
        </View>
        <Text variant="muted" style={[msgStyles.time, isMine && msgStyles.timeMine]}>
          {formatMessageTime(message.created_at)}
        </Text>
      </View>
    </View>
  )
}

const msgStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    paddingHorizontal: 12,
  },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start', gap: 6 },
  avatarSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  bubbleWrapper: { maxWidth: '72%', gap: 2 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: Colors.$backgroundPrimaryHeavy,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: Colors.$backgroundNeutralMedium,
    borderBottomLeftRadius: 4,
  },
  content: { lineHeight: 20 },
  contentMine: { color: '#fff' },
  time: { fontSize: 10, color: Colors.$textNeutralLight },
  timeMine: { textAlign: 'right' },
})

// ── Chat section (embedded in ScrollView) ────────────────────────────────────

export function TransactionChatSection({
  transactionId,
  currentUserId,
  otherUserId,
}: {
  transactionId: string
  currentUserId: string | undefined
  otherUserId: string
}) {
  const { data: messages = [] } = useTransactionMessages(transactionId)
  const { data: profiles } = useProfiles([otherUserId])

  const otherProfile = profiles?.[otherUserId]
  const otherUser: UserDisplayInfo | undefined = otherProfile
    ? {
        name: otherProfile.display_name ?? otherProfile.username ?? otherUserId.slice(0, 8),
        handle: `@${otherProfile.username ?? otherUserId.slice(0, 8)}`,
        avatar: otherProfile.avatar_url ?? '',
      }
    : undefined

  return (
    <View style={sectionStyles.container}>
      <Text variant="default" style={sectionStyles.label}>
        Messages
      </Text>

      {messages.length === 0 ? (
        <Text variant="muted" style={sectionStyles.empty}>
          Send a message to the other party.
        </Text>
      ) : (
        <View style={sectionStyles.list}>
          {messages.map((msg, idx) => {
            const isMine = msg.sender_id === currentUserId
            const nextMsg = messages[idx + 1]
            // Show avatar only on the last consecutive message from the other user
            const showAvatar = !isMine && (!nextMsg || nextMsg.sender_id !== msg.sender_id)
            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                isMine={isMine}
                otherUser={otherUser}
                showAvatar={showAvatar}
              />
            )
          })}
        </View>
      )}
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  container: { paddingTop: 12, paddingBottom: 8 },
  label: {
    fontWeight: '600',
    color: Colors.$textNeutral,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    color: Colors.$textNeutralLight,
  },
  list: { gap: 4 },
})

// ── Input bar (pinned outside ScrollView) ────────────────────────────────────

export function ChatInputBar({
  transactionId,
  currentUserId,
  insetBottom,
  disabled,
}: {
  transactionId: string
  currentUserId: string | undefined
  insetBottom: number
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)
  const { mutate: sendMessage, isPending } = useSendTransactionMessage()

  const canSend = text.trim().length > 0 && Boolean(currentUserId) && !isPending && !disabled

  const handleSend = () => {
    if (!canSend) return
    sendMessage({
      transactionId,
      senderId: currentUserId!,
      content: text.trim(),
    })
    setText('')
    inputRef.current?.clear()
  }

  return (
    <View style={[inputStyles.container, { paddingBottom: Math.max(insetBottom, 8) }]}>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder="Message..."
        placeholderTextColor={Colors.$textNeutralLight}
        style={inputStyles.input}
        multiline
        maxLength={500}
        returnKeyType="send"
        blurOnSubmit
        onSubmitEditing={handleSend}
        editable={!disabled}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        hitSlop={8}
        style={inputStyles.sendButton}
      >
        <SendHorizonal size={22} color={Colors.rgba(Colors.$iconPrimary, canSend ? 1 : 0.3)} />
      </TouchableOpacity>
    </View>
  )
}

const inputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.$outlineDefault,
    backgroundColor: Colors.$backgroundDefault,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
    }),
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.$outlineDefault,
    backgroundColor: Colors.$backgroundElevated,
    color: Colors.$textDefault,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
