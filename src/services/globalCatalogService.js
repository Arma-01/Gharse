import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

// Standard Grocery Categories across UR GROZY
export const GLOBAL_CATEGORIES = [
  'Rice & Grains',
  'Atta, Flours & Sooji',
  'Pulses & Dals',
  'Cooking Oils & Ghee',
  'Masalas & Spices',
  'Dairy & Eggs',
  'Fresh Vegetables',
  'Fresh Fruits',
  'Snacks & Biscuits',
  'Beverages & Juices',
  'Tea & Coffee',
  'Instant & Frozen Foods',
  'Cleaning Essentials',
  'Personal Care',
  'Household & Pooja Items',
  'General Groceries'
];

// Normalize text for duplicate checking and comparisons
export function normalizeText(text) {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// 1. FETCH GLOBAL CATALOG PRODUCTS (WITH DATABASE PAGINATION, SEARCH, FILTERS)
// ---------------------------------------------------------------------------
export async function fetchGlobalCatalog({
  page = 1,
  limit = 20,
  search = '',
  category = 'all',
  brand = 'all',
  isActive = 'all',
  storeUsage = 'all',
  sortField = 'created_at',
  sortOrder = 'desc'
} = {}) {
  if (!isSupabaseConfigured) {
    return { products: [], totalCount: 0, page: 1, limit, totalPages: 1, categories: GLOBAL_CATEGORIES, brands: [] };
  }

  try {
    // Universal / Global Catalog items in Supabase are rows in `products` with `shop_id IS NULL`
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .is('shop_id', null);

    // Filter by Active Status
    if (isActive === 'active') {
      query = query.eq('is_available', true);
    } else if (isActive === 'inactive') {
      query = query.eq('is_available', false);
    }

    // Filter by Category
    if (category && category !== 'all') {
      query = query.ilike('category', `%${category}%`);
    }

    // Search query across name, category, description
    const q = search.trim();
    if (q) {
      query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Sorting
    const ascending = sortOrder === 'asc';
    if (sortField === 'name') {
      query = query.order('name', { ascending });
    } else if (sortField === 'category') {
      query = query.order('category', { ascending });
    } else if (sortField === 'price') {
      query = query.order('price', { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching global catalog from products table:', error);
      return { products: [], totalCount: 0, page: 1, limit, totalPages: 1, categories: GLOBAL_CATEGORIES, brands: [] };
    }

    // Find store associations for these products from `products` where `shop_id IS NOT NULL`
    let storeCountMap = new Map();
    try {
      const { data: storeProdsData } = await supabase
        .from('products')
        .select('name, shop_id')
        .not('shop_id', 'is', null);

      if (storeProdsData) {
        storeProdsData.forEach(sp => {
          const normN = normalizeText(sp.name);
          storeCountMap.set(normN, (storeCountMap.get(normN) || 0) + 1);
        });
      }
    } catch {}

    let mappedProducts = (data || []).map(p => {
      const storesCount = storeCountMap.get(normalizeText(p.name)) || 0;
      
      return {
        id: p.id,
        globalProductId: p.id,
        name: p.name,
        brand: p.brand || 'Standard',
        description: p.description || '',
        category: p.category || 'General Groceries',
        subcategory: p.subcategory || '',
        unit: p.unit || '1 kg',
        quantity: 1,
        price: parseFloat(p.price || 0),
        mrp: parseFloat(p.mrp || p.price || 0),
        stock: p.stock != null ? parseInt(p.stock, 10) : 100,
        minThreshold: p.min_threshold != null ? parseInt(p.min_threshold, 10) : 5,
        imageUrl: p.image_url || '/images/cat_veg_fruits.jpg',
        image_url: p.image_url || '/images/cat_veg_fruits.jpg',
        barcode: '',
        searchKeywords: '',
        isActive: p.is_available !== false,
        is_active: p.is_available !== false,
        storesCount: storesCount,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || new Date().toISOString()
      };
    });

    if (storeUsage === 'assigned') {
      mappedProducts = mappedProducts.filter(p => p.storesCount > 0);
    } else if (storeUsage === 'unassigned') {
      mappedProducts = mappedProducts.filter(p => p.storesCount === 0);
    }

    const totalCount = count != null ? count : mappedProducts.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return {
      products: mappedProducts,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages,
      categories: GLOBAL_CATEGORIES,
      brands: ['Standard', 'Aashirvaad', 'Tata', 'Fortune', 'Amul', 'India Gate', 'Saffola', 'Dabur', 'Surf Excel', 'Nestle']
    };
  } catch (err) {
    console.error('Exception in fetchGlobalCatalog:', err);
    return { products: [], totalCount: 0, page: 1, limit, totalPages: 1, categories: GLOBAL_CATEGORIES, brands: [] };
  }
}

// ---------------------------------------------------------------------------
// 2. FETCH GLOBAL CATALOG KPI AGGREGATE STATS
// ---------------------------------------------------------------------------
export async function fetchGlobalCatalogStats() {
  if (!isSupabaseConfigured) {
    return {
      totalGlobalProducts: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      productsWithStores: 0,
      productsWithoutStores: 0
    };
  }

  try {
    const [globalRes, storeProdsRes] = await Promise.all([
      supabase.from('products').select('id, name, is_available').is('shop_id', null),
      supabase.from('products').select('name').not('shop_id', 'is', null)
    ]);

    if (globalRes.data) {
      const allGlobal = globalRes.data;
      const totalGlobalProducts = allGlobal.length;
      const activeProducts = allGlobal.filter(p => p.is_available !== false).length;
      const inactiveProducts = totalGlobalProducts - activeProducts;

      const storeProductNames = new Set((storeProdsRes.data || []).map(sp => normalizeText(sp.name)));
      const productsWithStores = allGlobal.filter(p => storeProductNames.has(normalizeText(p.name))).length;
      const productsWithoutStores = totalGlobalProducts - productsWithStores;

      return {
        totalGlobalProducts,
        activeProducts,
        inactiveProducts,
        productsWithStores,
        productsWithoutStores
      };
    }

    return { totalGlobalProducts: 0, activeProducts: 0, inactiveProducts: 0, productsWithStores: 0, productsWithoutStores: 0 };
  } catch (err) {
    console.error('Exception in fetchGlobalCatalogStats:', err);
    return { totalGlobalProducts: 0, activeProducts: 0, inactiveProducts: 0, productsWithStores: 0, productsWithoutStores: 0 };
  }
}

// ---------------------------------------------------------------------------
// 3. DUPLICATE DETECTION LOGIC
// ---------------------------------------------------------------------------
export async function checkDuplicateGlobalProduct({
  name = '',
  brand = '',
  unit = '',
  quantity = 1,
  barcode = '',
  excludeId = null
}) {
  if (!isSupabaseConfigured) return { hasDuplicate: false, duplicates: [] };

  const normName = normalizeText(name);
  const normUnit = normalizeText(unit);

  if (!normName) return { hasDuplicate: false, duplicates: [] };

  try {
    const { data: nameMatches } = await supabase
      .from('products')
      .select('*')
      .is('shop_id', null)
      .ilike('name', `%${normName}%`);

    if (nameMatches && nameMatches.length > 0) {
      const potentialDuplicates = nameMatches.filter(p => {
        if (excludeId && p.id === excludeId) return false;

        const pName = normalizeText(p.name);
        const pUnit = normalizeText(p.unit);

        // Exact match on normalized name and unit
        if (pName === normName && (!normUnit || pUnit === normUnit)) {
          return true;
        }

        // Close substring match
        if (pName === normName || pName.includes(normName) || normName.includes(pName)) {
          return true;
        }

        return false;
      });

      if (potentialDuplicates.length > 0) {
        return {
          hasDuplicate: true,
          matchReason: `Potential duplicate product found with matching name in catalog`,
          duplicates: potentialDuplicates
        };
      }
    }

    return { hasDuplicate: false, duplicates: [] };
  } catch (err) {
    console.error('Exception in checkDuplicateGlobalProduct:', err);
    return { hasDuplicate: false, duplicates: [] };
  }
}

// ---------------------------------------------------------------------------
// 4. CREATE GLOBAL PRODUCT IN SUPABASE
// ---------------------------------------------------------------------------
export async function createGlobalProduct(productData) {
  if (!isSupabaseConfigured) return null;

  try {
    let desc = (productData.description || '').trim();
    const barcode = (productData.barcode || '').trim();
    if (barcode && !desc.includes(barcode)) {
      desc = desc ? `${desc} [Barcode: ${barcode}]` : `Barcode: ${barcode}`;
    }

    const payload = {
      name: (productData.name || '').trim(),
      category: productData.category || 'General Groceries',
      price: parseFloat(productData.price || 0),
      mrp: parseFloat(productData.mrp || productData.price || 0),
      unit: (productData.unit || '1 kg').trim(),
      stock: parseInt(productData.stock || 100, 10),
      min_threshold: parseInt(productData.minThreshold || 5, 10),
      image_url: productData.imageUrl || productData.image_url || '/images/cat_veg_fruits.jpg',
      description: desc,
      is_available: productData.isActive !== false && productData.is_available !== false,
      shop_id: null, // Marks as universal Global Catalog item
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Failed to create product in Supabase:', error);
      return null;
    }

    return {
      ...data,
      globalProductId: data.id,
      imageUrl: data.image_url,
      isActive: data.is_available
    };
  } catch (err) {
    console.error('Exception in createGlobalProduct:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. UPDATE GLOBAL PRODUCT IN SUPABASE
// ---------------------------------------------------------------------------
export async function updateGlobalProduct(productId, productData) {
  if (!isSupabaseConfigured || !productId) return false;

  try {
    let desc = productData.description != null ? String(productData.description).trim() : '';
    const barcode = (productData.barcode || '').trim();
    if (barcode && !desc.includes(barcode)) {
      desc = desc ? `${desc} [Barcode: ${barcode}]` : `Barcode: ${barcode}`;
    }

    const updatePayload = {
      name: (productData.name || '').trim(),
      category: productData.category || 'General Groceries',
      price: parseFloat(productData.price || 0),
      mrp: parseFloat(productData.mrp || productData.price || 0),
      unit: (productData.unit || '1 kg').trim(),
      image_url: productData.imageUrl || productData.image_url || '/images/cat_veg_fruits.jpg',
      description: desc,
      is_available: productData.isActive !== false && productData.is_available !== false,
      updated_at: new Date().toISOString()
    };

    if (productData.stock != null) {
      updatePayload.stock = parseInt(productData.stock, 10);
    }
    if (productData.minThreshold != null) {
      updatePayload.min_threshold = parseInt(productData.minThreshold, 10);
    }

    const { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    if (error) {
      console.error('Failed to update product in Supabase:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception in updateGlobalProduct:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 6. DELETE GLOBAL PRODUCT FROM SUPABASE
// ---------------------------------------------------------------------------
export async function deleteGlobalProduct(productId) {
  if (!isSupabaseConfigured || !productId) return false;

  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      // If delete constraint or issue, soft deactivate
      const { error: deactErr } = await supabase
        .from('products')
        .update({ is_available: false, updated_at: new Date().toISOString() })
        .eq('id', productId);

      return !deactErr;
    }

    return true;
  } catch (err) {
    console.error('Exception in deleteGlobalProduct:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 7. FETCH STORE ASSIGNMENTS FOR A GLOBAL PRODUCT
// ---------------------------------------------------------------------------
export async function fetchStoreAssignmentsForProduct(globalProductId) {
  if (!isSupabaseConfigured || !globalProductId) return [];

  try {
    // 1. Get the global product name
    const { data: globalProd } = await supabase
      .from('products')
      .select('*')
      .eq('id', globalProductId)
      .single();

    if (!globalProd) return [];

    const normName = normalizeText(globalProd.name);

    // 2. Fetch stores carrying this product + all shops
    const [storeProdsRes, shopsRes] = await Promise.all([
      supabase.from('products').select('*').not('shop_id', 'is', null),
      supabase.from('shops').select('*')
    ]);

    if (!storeProdsRes.data || !shopsRes.data) return [];

    const shopMap = new Map();
    shopsRes.data.forEach(s => shopMap.set(s.id, s));

    const matchedStoreProds = storeProdsRes.data.filter(sp => 
      normalizeText(sp.name) === normName || sp.name.toLowerCase().includes(normName)
    );

    return matchedStoreProds.map(sp => {
      const shop = shopMap.get(sp.shop_id) || {};
      return {
        storeProductId: sp.id,
        storeId: sp.shop_id,
        globalProductId: globalProductId,
        storeName: shop.name || 'Store Partner',
        storePhone: shop.phone || '',
        storeAddress: shop.address || '',
        locality: shop.locality || 'Local Area',
        city: shop.city || 'Bengaluru',
        price: parseFloat(sp.price || 0),
        mrp: parseFloat(sp.mrp || sp.price || 0),
        stock: sp.stock != null ? parseInt(sp.stock, 10) : 50,
        minThreshold: sp.min_threshold != null ? parseInt(sp.min_threshold, 10) : 5,
        isAvailable: sp.is_available !== false,
        storeSku: '',
        createdAt: sp.created_at || new Date().toISOString(),
        updatedAt: sp.updated_at || new Date().toISOString()
      };
    });
  } catch (err) {
    console.error('Exception in fetchStoreAssignmentsForProduct:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 8. ASSIGN PRODUCT TO A STORE (STORE PRICING & INVENTORY)
// ---------------------------------------------------------------------------
export async function assignProductToStore({
  storeId,
  globalProductId,
  price = 0,
  mrp = null,
  stock = 50,
  minThreshold = 5,
  isAvailable = true,
  storeSku = ''
}) {
  if (!isSupabaseConfigured || !storeId || !globalProductId) return null;

  try {
    // 1. Fetch the master global product details
    const { data: globalProd } = await supabase
      .from('products')
      .select('*')
      .eq('id', globalProductId)
      .single();

    const name = globalProd ? globalProd.name : 'Grocery Item';
    const category = globalProd ? globalProd.category : 'General Groceries';
    const unit = globalProd ? globalProd.unit : '1 kg';
    const imageUrl = globalProd ? globalProd.image_url : '/images/cat_veg_fruits.jpg';
    const desc = globalProd ? globalProd.description : '';

    // Check if store already has a row for this product name
    const { data: existingStoreProd } = await supabase
      .from('products')
      .select('id')
      .eq('shop_id', storeId)
      .eq('name', name)
      .maybeSingle();

    if (existingStoreProd) {
      // Update existing store pricing
      const { data: updated, error: upErr } = await supabase
        .from('products')
        .update({
          price: parseFloat(price || 0),
          mrp: mrp ? parseFloat(mrp) : parseFloat(price || 0),
          stock: parseInt(stock || 0, 10),
          min_threshold: parseInt(minThreshold || 5, 10),
          is_available: Boolean(isAvailable),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStoreProd.id)
        .select()
        .single();

      if (upErr) return null;
      return updated;
    }

    // Insert new store-specific product row
    const payload = {
      shop_id: storeId,
      name: name,
      category: category,
      price: parseFloat(price || 0),
      mrp: mrp ? parseFloat(mrp) : parseFloat(price || 0),
      unit: unit,
      stock: parseInt(stock || 50, 10),
      min_threshold: parseInt(minThreshold || 5, 10),
      image_url: imageUrl,
      description: desc,
      is_available: Boolean(isAvailable),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error assigning product to store:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception in assignProductToStore:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 9. UPDATE STORE PRODUCT PRICING & STOCK
// ---------------------------------------------------------------------------
export async function updateStoreProductPricing({
  storeProductId,
  price,
  mrp,
  stock,
  minThreshold,
  isAvailable,
  storeSku
}) {
  if (!isSupabaseConfigured || !storeProductId) return false;

  try {
    const updatePayload = {
      price: parseFloat(price || 0),
      mrp: mrp ? parseFloat(mrp) : parseFloat(price || 0),
      updated_at: new Date().toISOString()
    };

    if (stock != null) updatePayload.stock = parseInt(stock, 10);
    if (minThreshold != null) updatePayload.min_threshold = parseInt(minThreshold, 10);
    if (isAvailable !== undefined) updatePayload.is_available = Boolean(isAvailable);

    const { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', storeProductId);

    if (error) {
      console.error('Failed to update store product in Supabase:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception in updateStoreProductPricing:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 10. REMOVE PRODUCT FROM STORE
// ---------------------------------------------------------------------------
export async function removeProductFromStore(storeProductId) {
  if (!isSupabaseConfigured || !storeProductId) return false;

  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', storeProductId);

    return !error;
  } catch (err) {
    console.error('Exception in removeProductFromStore:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 11. FETCH STORE INVENTORY (STORE PRODUCTS)
// ---------------------------------------------------------------------------
export async function fetchStoreInventory(storeId, { search = '', category = 'all', isAvailable = 'all' } = {}) {
  if (!isSupabaseConfigured || !storeId) return [];

  try {
    let query = supabase
      .from('products')
      .select('*')
      .eq('shop_id', storeId)
      .order('created_at', { ascending: false });

    if (isAvailable === 'available') {
      query = query.eq('is_available', true);
    } else if (isAvailable === 'unavailable') {
      query = query.eq('is_available', false);
    }

    if (category && category !== 'all') {
      query = query.ilike('category', `%${category}%`);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    let mapped = data.map(p => {
      const price = parseFloat(p.price || 0);
      const mrp = parseFloat(p.mrp || p.price || 0);
      const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
      const stock = p.stock != null ? parseInt(p.stock, 10) : 50;

      return {
        id: p.id,
        storeProductId: p.id,
        globalProductId: p.id,
        shop_id: p.shop_id,
        storeId: p.shop_id,
        name: p.name,
        brand: p.brand || 'Store Fresh',
        category: p.category || 'General Groceries',
        unit: p.unit || '1 kg',
        price: price,
        originalPrice: mrp,
        mrp: mrp,
        discount: discount,
        stock: stock,
        minThreshold: p.min_threshold || 5,
        status: (stock > 0 && p.is_available !== false) ? 'In Stock' : 'Out of Stock',
        image: p.image_url || '/images/cat_veg_fruits.jpg',
        image_url: p.image_url || '/images/cat_veg_fruits.jpg',
        imageUrl: p.image_url || '/images/cat_veg_fruits.jpg',
        description: p.description || '',
        isAvailable: p.is_available !== false,
        is_available: p.is_available !== false,
        rating: 4.9,
        reviews: 18,
        createdAt: p.created_at || new Date().toISOString()
      };
    });

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      mapped = mapped.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      );
    }

    return mapped;
  } catch (err) {
    console.error('Exception in fetchStoreInventory:', err);
    return [];
  }
}
