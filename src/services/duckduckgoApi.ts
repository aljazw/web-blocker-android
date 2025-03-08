

// const fetchSearchResults = async (query: string) => {
//     const url = "https://www.searchapi.io/api/v1/search";
//     const params = {
//         engine: "duckduckgo",
//         q: query,
//         api_key: "piMi6p7mRN98np8MHU3Sv7SR" // Replace with your actual API key
//     };

//     const queryString = new URLSearchParams(params).toString();

//     try {
//         const response = await fetch(`${url}?${queryString}`, {
//             method: 'GET',
//             headers: {
//                 'Content-Type': 'application/json', // Add content type if needed
//             }
//         });

//         if (!response.ok) {
//             throw new Error('Network response was not ok');
//         }

//         const data = await response.json();
//         return data;
        
//     } catch (error) {
//         console.error('Error fetching search results:', error);
//     }
// };
interface RelatedTopic {
    FirstURL?: string;
    Text?: string;
    Result?: string;
    Icon?: { URL: string };
}

interface DuckDuckGoResponse {
RelatedTopics: RelatedTopic[];
}

const fetchSearchResults = async (query: string) => {
    const duckDuckGoApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;

    try {
        const response = await fetch(duckDuckGoApiUrl);
        const data = await response.json();
        
        console.log('Data: ', data);

        // Extract results (if available)
        const results = data.RelatedTopics.map((item: any) => item.Text).filter(Boolean);
        
        return results;
    } catch (error) {
        console.error('Error fetching results:', error);
        return ['Error fetching results'];
    }

};


export { fetchSearchResults };