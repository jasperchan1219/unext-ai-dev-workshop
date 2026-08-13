// 這支檔案負責「跟 Supabase 建立連線」，其他檔案要用 Supabase 時都從這裡拿 client
//
// 這兩個值不是密碼，可以放心寫在這裡（甚至被瀏覽器看到也沒關係）——
// 真正擋住別人亂讀亂寫資料的是資料庫那邊的 RLS 規則，不是這兩個值。

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
