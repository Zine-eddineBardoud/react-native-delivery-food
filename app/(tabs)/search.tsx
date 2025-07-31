import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Search = () => {

    return (
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Search</Text>
        </SafeAreaView>
    )
}

export default Search;