import { ID } from "react-native-appwrite";
import { appwriteConfig, databases, storage } from "./appwrite";
import dummyData from "./data";

interface Category {
    name: string;
    description: string;
}

interface Customization {
    name: string;
    price: number;
    type: "topping" | "side" | "size" | "crust" | string; // extend as needed
}

interface MenuItem {
    name: string;
    description: string;
    image_url: string;
    price: number;
    rating: number;
    calories: number;
    protein: number;
    category_name: string;
    customizations: string[]; // list of customization names
}

interface DummyData {
    categories: Category[];
    customizations: Customization[];
    menu: MenuItem[];
}

// ensure dummyData has correct shape
const data = dummyData as DummyData;

async function clearAll(collectionId: string): Promise<void> {
    try {
        console.log(`Clearing collection: ${collectionId}`);
        const list = await databases.listDocuments(
            appwriteConfig.databaseId,
            collectionId
        );

        await Promise.all(
            list.documents.map((doc) =>
                databases.deleteDocument(appwriteConfig.databaseId, collectionId, doc.$id)
            )
        );
        console.log(`✅ Cleared collection: ${collectionId}`);
    } catch (error) {
        console.error(`❌ Error clearing collection ${collectionId}:`, error);
        throw error;
    }
}

async function clearStorage(): Promise<void> {
    try {
        console.log("Clearing storage...");
        const list = await storage.listFiles(appwriteConfig.bucketId);

        await Promise.all(
            list.files.map((file) =>
                storage.deleteFile(appwriteConfig.bucketId, file.$id)
            )
        );
        console.log("✅ Cleared storage");
    } catch (error) {
        console.error("❌ Error clearing storage:", error);
        throw error;
    }
}

async function uploadImageToStorage(imageUrl: string) {
    try {
        console.log(`Uploading image: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();

        const fileObj = {
            name: imageUrl.split("/").pop() || `file-${Date.now()}.jpg`,
            type: blob.type,
            size: blob.size,
            uri: imageUrl,
        };

        const file = await storage.createFile(
            appwriteConfig.bucketId,
            ID.unique(),
            fileObj
        );

        const fileUrl = storage.getFileViewURL(appwriteConfig.bucketId, file.$id);
        console.log(`✅ Uploaded image: ${fileUrl}`);
        return fileUrl;
    } catch (error) {
        console.error(`❌ Error uploading image ${imageUrl}:`, error);
        // Use the original URL as fallback instead of failing completely
        console.log(`⚠️ Using original URL as fallback: ${imageUrl}`);
        return imageUrl;
    }
}

async function seed(): Promise<void> {
    try {
        console.log("🚀 Starting seeding process...");
        
        // 1. Clear all
        await clearAll(appwriteConfig.categoriesCollectionId);
        await clearAll(appwriteConfig.customizationsCollectionId);
        await clearAll(appwriteConfig.menuCollectionId);
        await clearAll(appwriteConfig.menuCustomizationsCollectionId);
        await clearStorage();

        // 2. Create Categories
        console.log("📝 Creating categories...");
        const categoryMap: Record<string, string> = {};
        for (const cat of data.categories) {
            try {
                const doc = await databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.categoriesCollectionId,
                    ID.unique(),
                    cat
                );
                categoryMap[cat.name] = doc.$id;
                console.log(`✅ Created category: ${cat.name}`);
            } catch (error) {
                console.error(`❌ Error creating category ${cat.name}:`, error);
                throw error;
            }
        }

        // 3. Create Customizations
        console.log("🔧 Creating customizations...");
        const customizationMap: Record<string, string> = {};
        for (const cus of data.customizations) {
            try {
                const doc = await databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.customizationsCollectionId,
                    ID.unique(),
                    {
                        name: cus.name,
                        price: cus.price,
                        type: cus.type,
                    }
                );
                customizationMap[cus.name] = doc.$id;
                console.log(`✅ Created customization: ${cus.name}`);
            } catch (error) {
                console.error(`❌ Error creating customization ${cus.name}:`, error);
                throw error;
            }
        }

        // 4. Create Menu Items
        console.log("🍔 Creating menu items...");
        const menuMap: Record<string, string> = {};
        for (const item of data.menu) {
            try {
                console.log(`Processing menu item: ${item.name}`);
                
                // Check if category exists
                if (!categoryMap[item.category_name]) {
                    throw new Error(`Category not found: ${item.category_name}`);
                }

                const uploadedImage = await uploadImageToStorage(item.image_url);

                const doc = await databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.menuCollectionId,
                    ID.unique(),
                    {
                        name: item.name,
                        description: item.description,
                        image_url: uploadedImage,
                        price: item.price,
                        rating: item.rating,
                        calories: item.calories,
                        protein: item.protein,
                        categories: categoryMap[item.category_name],
                    }
                );

                menuMap[item.name] = doc.$id;
                console.log(`✅ Created menu item: ${item.name}`);

                // 5. Create menu_customizations
                console.log(`🔗 Creating customizations for: ${item.name}`);
                for (const cusName of item.customizations) {
                    try {
                        if (!customizationMap[cusName]) {
                            console.warn(`⚠️ Customization not found: ${cusName}, skipping...`);
                            continue;
                        }
                        
                        await databases.createDocument(
                            appwriteConfig.databaseId,
                            appwriteConfig.menuCustomizationsCollectionId,
                            ID.unique(),
                            {
                                menu: doc.$id,
                                customizations: customizationMap[cusName],
                            }
                        );
                        console.log(`✅ Created menu customization: ${item.name} - ${cusName}`);
                    } catch (error) {
                        console.error(`❌ Error creating menu customization ${item.name} - ${cusName}:`, error);
                        // Continue with other customizations instead of failing completely
                    }
                }
            } catch (error) {
                console.error(`❌ Error creating menu item ${item.name}:`, error);
                throw error;
            }
        }

        console.log("✅ Seeding complete.");
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        throw error;
    }
}

export default seed;
