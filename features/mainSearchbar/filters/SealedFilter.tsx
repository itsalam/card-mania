import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { FilterBadge } from './ToggleBadge';
import { useFilters } from './providers';

export function AttributeFilter() {
    const { sealed, owned, wishlisted, unowned, setSealed, setOwned, setWishlisted, setUnowned } = useFilters()

    return <View className='flex flex-row gap-2 items-center'>
        <Text className='text-lg font-medium'>Attributes</Text>
        <Separator orientation='vertical' />
        <ScrollView horizontal >    
            <View className='flex-row gap-2'>   
                <FilterBadge filterKey='sealed' checked={sealed} onCheckedChange={setSealed} /> 
                <FilterBadge filterKey='owned' checked={owned}  onCheckedChange={setOwned} />
                <FilterBadge filterKey='wishlisted' checked={wishlisted}  onCheckedChange={setWishlisted} />
                <FilterBadge filterKey='unowned' checked={unowned}  onCheckedChange={setUnowned} /> 
            </View>
        </ScrollView>
    </View>

}
