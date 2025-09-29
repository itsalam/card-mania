import { AnimatePresence, MotiView } from 'moti';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function FabMenu() {
  const [expanded, setExpanded] = useState(false);
  return (
<>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={[
          styles.button,
          {
            backgroundColor: expanded ? '#2F4EB2' : '#10243E',
            borderColor: '#2F4EB2',
          },
        ]}
      >
        <MotiView
          className='absolute'
          animate={{ scale: expanded ? 1.5 : 1 }}
          transition={{
            duration: 150,
            type: 'timing',
          }}
        >
          <Text>🎁</Text>
        </MotiView>
      </Pressable>
      <AnimatePresence>
        {expanded && (
          <View className="absolute bottom-20 right-20 flex flex-row gap-2 z-fab">
            {actions.map((action, i) => (
              <ActionButton key={i.toString()} action={action} index={i} />
            ))}
          </View>
        )}
      </AnimatePresence>
      </>
  );
}

function ActionButton({ action, index }) {
  return (
    <MotiView
      transition={{ delay: index * 100, damping: 15, mass: 1 }}
      from={{
        opacity: 0,
        translateX: 0,
      }}
      animate={{
        opacity: 1,
        translateX: -65 * (index + 1),
      }}
      exit={{
        opacity: 0,
        translateX: 0,
      }}
    >
      <Pressable
        onPress={() => console.log(action.type)}
        style={[
          styles.button,
          {
            backgroundColor: action.color,
            shadowColor: action.color,
            borderColor: action.border,
          },
        ]}
      >
        <Text style={{ fontSize: 18 }}>{action.emoji}</Text>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#111',
    padding: 8,
  },
  button: {
    borderRadius: 100,
    width: 55,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 100,
    right: 100,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 50,
    borderWidth: 2,
  },
});

const actions = [
  {
    type: 'Send',
    color: '#341A34',
    emoji: '👨🏻‍🚒',
    border: '#692D6F',
  },
  {
    type: 'Scan',
    color: '#16301D',
    emoji: '📸',
    border: '#2F6E3B',
  },

  {
    type: 'Activity',
    color: '#3B1813',
    emoji: '🌊',
    border: '#7F2315',
  },
];
