
import { Background } from '@/components/Background';
import HomeScreen from '@/features/home';

export default function HomePage() {
  return (
          <Background className='w-full h-full flex-1' >
    <HomeScreen/>
    </Background>
  );
}

