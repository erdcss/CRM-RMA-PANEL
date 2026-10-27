import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "../lib/api";
import { C } from "../ui/theme";
import type { B2BProduct } from "../types";
import { BackHeader, SectionTitle } from "./common";

type ProductForm = {
  sku: string;
  name: string;
  barcode: string;
  brand: string;
  category: string;
  collectionName: string;
  tags: string;
  price: string;
  stock: string;
  minOrderQty: string;
  unitsPerBox: string;
  description: string;
  images: string[];
};

const initialForm: ProductForm = {
  sku: "",
  name: "",
  barcode: "",
  brand: "",
  category: "",
  collectionName: "",
  tags: "",
  price: "",
  stock: "0",
  minOrderQty: "1",
  unitsPerBox: "1",
  description: "",
  images: [],
};

export function ProductAddScreen({
  onBack,
  onCreated,
  productId,
}: {
  onBack: () => void;
  onCreated: () => void;
  productId?: string;
}) {
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId));
  const [loadError, setLoadError] = useState("");
  const [variants, setVariants] = useState<unknown[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (!productId) return;
    let active = true;
    setLoadingProduct(true);
    setLoadError("");
    apiFetch<B2BProduct>("/api/admin/b2b-products/" + encodeURIComponent(productId))
      .then((product) => {
        if (!active) return;
        let images: string[] = [];
        if (Array.isArray(product.images)) {
          images = product.images.filter((value): value is string => typeof value === "string" && !!value.trim());
        } else if (typeof product.images === "string") {
          try {
            const parsed: unknown = JSON.parse(product.images);
            if (Array.isArray(parsed)) images = parsed.filter((value): value is string => typeof value === "string");
          } catch { /* Older rows may not contain JSON images */ }
        }
        if (!images.length && product.image_data) images = [product.image_data];
        let existingVariants: unknown = product.variants;
        if (typeof existingVariants === "string") {
          try { existingVariants = JSON.parse(existingVariants); } catch { existingVariants = []; }
        }
        setVariants(Array.isArray(existingVariants) ? existingVariants : []);
        setForm({
          sku: product.sku || "",
          name: product.name || "",
          barcode: product.barcode || "",
          brand: product.brand || "",
          category: product.category || "",
          collectionName: product.collection_name || "",
          tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
          price: String(product.price ?? 0),
          stock: String(product.stock ?? 0),
          minOrderQty: String(product.min_order_qty ?? 1),
          unitsPerBox: String(product.units_per_box ?? 1),
          description: product.description || "",
          images,
        });
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Ürün bilgileri alınamadı");
      })
      .finally(() => { if (active) setLoadingProduct(false); });
    return () => { active = false; };
  }, [productId]);

  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function openScanner() {
    let permission = cameraPermission;
    if (!permission?.granted) {
      permission = await requestCameraPermission();
    }

    if (!permission.granted) {
      Alert.alert(
        "Kamera izni gerekli",
        "Barkodu kamerayla okutmak için Çalışkan Business uygulamasına kamera izni verin.",
      );
      return;
    }

    setScanLocked(false);
    setScannerOpen(true);
  }

  function handleBarcode(data: string) {
    if (scanLocked) return;
    const value = String(data || "").trim();
    if (!value) return;

    setScanLocked(true);
    set("barcode", value);
    setScannerOpen(false);
  }

  async function pickImages() {
    const room = Math.max(0, 4 - form.images.length);
    if (room === 0) {
      Alert.alert("Görsel sınırı", "Mobil uygulamada en fazla 4 ürün görseli ekleyebilirsiniz.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Fotoğraf izni gerekli",
        "Ürün görseli eklemek için fotoğraf arşivi izni verin.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: room,
      base64: true,
      quality: 0.45,
    });

    if (result.canceled) return;

    const next: string[] = [];
    for (const asset of result.assets.slice(0, room)) {
      if (!asset.base64) continue;
      const mime =
        asset.mimeType && asset.mimeType.startsWith("image/")
          ? asset.mimeType
          : "image/jpeg";
      next.push(`data:${mime};base64,${asset.base64}`);
    }

    if (!next.length) {
      Alert.alert("Görsel eklenemedi", "Seçilen görseller işlenemedi.");
      return;
    }

    set("images", [...form.images, ...next]);
  }

  async function submit() {
    if (busy || loadingProduct || loadError) return;
    if (!form.sku.trim() || !form.name.trim()) {
      Alert.alert("Eksik bilgi", "Stok kodu ve ürün adı zorunludur.");
      return;
    }

    const price = Number(form.price.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert("Fiyat hatası", "Geçerli bir ürün fiyatı girin.");
      return;
    }

    if (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0 ||
        !Number.isInteger(Number(form.minOrderQty)) || Number(form.minOrderQty) < 1 ||
        !Number.isInteger(Number(form.unitsPerBox)) || Number(form.unitsPerBox) < 1) {
      Alert.alert("Stok bilgisi hatası", "Stok sıfır veya pozitif; minimum sipariş ve koli adedi en az 1 olmalıdır.");
      return;
    }

    if (form.images.length === 0) {
      Alert.alert("Ürün görseli gerekli", "Ürünü kaydetmek için en az bir görsel ekleyin.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(productId ? "/api/admin/b2b-products/" + encodeURIComponent(productId) : "/api/admin/b2b-products", {
        method: productId ? "PATCH" : "POST",
        body: JSON.stringify({
          sku: form.sku.trim(),
          name: form.name.trim(),
          barcode: form.barcode.trim(),
          brand: form.brand.trim(),
          category: form.category.trim(),
          collectionName: form.collectionName.trim(),
          tags: form.tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          price,
          stock: Math.max(0, Number(form.stock || 0)),
          minOrderQty: Math.max(1, Number(form.minOrderQty || 1)),
          unitsPerBox: Math.max(1, Number(form.unitsPerBox || 1)),
          description: form.description.trim(),
          images: form.images,
          variants,
        }),
      });

      Alert.alert(productId ? "Ürün güncellendi" : "Ürün eklendi", productId ? "Ürün bilgileri ve görselleri kaydedildi." : "Ürün Çalışkan B2B kataloğuna kaydedildi.", [
        { text: "Tamam", onPress: onCreated },
      ]);
    } catch (error) {
      Alert.alert(
        productId ? "Ürün güncellenemedi" : "Ürün eklenemedi",
        error instanceof Error ? error.message : "Bilinmeyen hata",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loadingProduct || loadError) {
    return (
      <View style={s.root}>
        <View style={s.loadWrap}>
          <BackHeader title="Ürün Düzenle" subtitle="Ürün bilgileri yükleniyor" onBack={onBack} />
          {loadingProduct ? <ActivityIndicator color={C.blue} size="large" /> : <Text style={s.error}>{loadError}</Text>}
          {loadError ? <TouchableOpacity onPress={onBack} style={s.backButton}><Text style={s.backButtonText}>Ürünlere dön</Text></TouchableOpacity> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackHeader
          title={productId ? "Ürün Düzenle" : "Ürün Ekle"}
          subtitle={productId ? "Kayıtlı ürünü, stok bilgilerini ve görsellerini güncelleyin." : "B2B kataloğuna yeni ürün oluşturun."}
          onBack={onBack}
        />

        <SectionTitle title="Temel Bilgiler" />
        <View style={s.card}>
          <Field label="Stok kodu *" value={form.sku} onChangeText={(value) => set("sku", value)} />
          <Field label="Ürün adı *" value={form.name} onChangeText={(value) => set("name", value)} />

          <Text style={s.label}>Barkod</Text>
          <View style={s.barcodeRow}>
            <TextInput
              style={[s.input, s.barcodeInput]}
              value={form.barcode}
              onChangeText={(value) => set("barcode", value.replace(/\s/g, ""))}
              placeholder="Barkod numarası"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              autoCorrect={false}
            />
            <TouchableOpacity style={s.scanButton} onPress={() => void openScanner()}>
              <Text style={s.scanIcon}>▣</Text>
              <Text style={s.scanText}>Kamera ile Tara</Text>
            </TouchableOpacity>
          </View>

          <Field label="Marka" value={form.brand} onChangeText={(value) => set("brand", value)} />
          <Field label="Kategori" value={form.category} onChangeText={(value) => set("category", value)} />
          <Field label="Koleksiyon" value={form.collectionName} onChangeText={(value) => set("collectionName", value)} />
          <Field
            label="Etiketler"
            value={form.tags}
            onChangeText={(value) => set("tags", value)}
            placeholder="yeni, elektronik, kampanya"
          />
        </View>

        <SectionTitle title="Fiyat ve Stok" />
        <View style={s.twoColumn}>
          <SmallField
            label="Fiyat *"
            value={form.price}
            onChangeText={(value) => set("price", value)}
            keyboardType="decimal-pad"
          />
          <SmallField
            label="Stok *"
            value={form.stock}
            onChangeText={(value) => set("stock", value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
          />
          <SmallField
            label="Minimum Sipariş"
            value={form.minOrderQty}
            onChangeText={(value) => set("minOrderQty", value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
          />
          <SmallField
            label="Koli İçi Adet"
            value={form.unitsPerBox}
            onChangeText={(value) => set("unitsPerBox", value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
          />
        </View>

        <SectionTitle title="Ürün Görselleri" />
        <View style={s.imagesCard}>
          <View style={s.imageHeader}>
            <View style={s.imageHeaderText}>
              <Text style={s.imageTitle}>Ürün görselleri</Text>
              <Text style={s.imageSub}>İlk görsel ana üründür. Güncellemek için görsel ekleyin veya kaldırın.</Text>
            </View>
            <TouchableOpacity style={s.addImageButton} onPress={() => void pickImages()}>
              <Text style={s.addImageButtonText}>+ Görsel Ekle</Text>
            </TouchableOpacity>
          </View>

          {form.images.length === 0 ? (
            <View style={s.imageEmpty}>
              <Text style={s.imageEmptyIcon}>□</Text>
              <Text style={s.imageEmptyText}>Henüz görsel eklenmedi</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.imageRail}>
              {form.images.map((image, index) => (
                <View key={`${image.slice(0, 28)}-${index}`} style={s.imageWrap}>
                  <Image source={{ uri: image }} style={s.image as import("react-native").ImageStyle} resizeMode="cover" />
                  {index === 0 ? <Text style={s.mainBadge}>ANA</Text> : null}
                  <TouchableOpacity
                    style={s.removeImage}
                    onPress={() =>
                      set(
                        "images",
                        form.images.filter((_, imageIndex) => imageIndex !== index),
                      )
                    }
                  >
                    <Text style={s.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <SectionTitle title="Açıklama" />
        <TextInput
          style={s.description}
          value={form.description}
          onChangeText={(value) => set("description", value)}
          placeholder="Ürün açıklaması..."
          placeholderTextColor={C.muted}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[s.saveButton, busy && s.disabled]}
          onPress={() => void submit()}
          disabled={busy}
          activeOpacity={0.82}
        >
          {busy ? (
            <ActivityIndicator color="#071019" />
          ) : (
            <>
              <Text style={s.saveText}>{productId ? "Değişiklikleri Kaydet" : "Ürünü Kaydet"}</Text>
              <Text style={s.saveArrow}>→</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={s.scannerRoot}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code128",
                "code39",
                "code93",
                "itf14",
                "codabar",
              ],
            }}
            onBarcodeScanned={({ data }) => handleBarcode(data)}
          />

          <View style={s.scannerShadeTop}>
            <TouchableOpacity style={s.closeScanner} onPress={() => setScannerOpen(false)}>
              <Text style={s.closeScannerText}>‹ Geri</Text>
            </TouchableOpacity>
            <Text style={s.scannerTitle}>Barkodu okutun</Text>
            <Text style={s.scannerSub}>
              Barkodu çerçevenin içine getirin. Numara otomatik olarak ürün formuna yazılacak.
            </Text>
          </View>

          <View style={s.scanFrame}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
            <View style={s.scanLine} />
          </View>

          <View style={s.scannerBottom}>
            <Text style={s.scannerBottomText}>EAN · UPC · Code 128 · Code 39 desteklenir</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
      />
    </View>
  );
}

function SmallField({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType: "number-pad" | "decimal-pad";
}) {
  return (
    <View style={s.smallField}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={C.muted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadWrap: { padding: 18, flex: 1 },
  error: { color: C.red, fontSize: 13, lineHeight: 19 },
  backButton: { padding: 12, marginTop: 15, borderRadius: 12, backgroundColor: C.panel2 },
  backButtonText: { color: C.text, textAlign: "center" },
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 40 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 15,
  },
  field: { marginBottom: 14 },
  label: { color: C.text2, fontSize: 11, fontWeight: "500", marginBottom: 7 },
  input: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  barcodeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  barcodeInput: { flex: 1 },
  scanButton: {
    width: 118,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.38)",
    backgroundColor: C.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scanIcon: { color: "#A9C7FF", fontSize: 16 },
  scanText: { color: "#A9C7FF", fontSize: 10, fontWeight: "600", marginTop: 2 },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  smallField: { width: "48%" },
  imagesCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 14,
  },
  imageHeader: { flexDirection: "row", alignItems: "center" },
  imageHeaderText: { flex: 1, paddingRight: 10 },
  imageTitle: { color: C.text, fontSize: 13, fontWeight: "600" },
  imageSub: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  addImageButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    justifyContent: "center",
  },
  addImageButtonText: { color: C.text2, fontSize: 11, fontWeight: "600" },
  imageEmpty: {
    minHeight: 116,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  imageEmptyIcon: { color: C.muted, fontSize: 26 },
  imageEmptyText: { color: C.muted, fontSize: 11, marginTop: 6 },
  imageRail: { gap: 10, paddingTop: 14 },
  imageWrap: { width: 112, height: 112, borderRadius: 17, overflow: "hidden", backgroundColor: C.panel2 },
  image: { width: "100%", height: "100%" },
  mainBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    color: C.text,
    backgroundColor: "rgba(0,0,0,0.72)",
    fontSize: 8,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: "hidden",
  },
  removeImage: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageText: { color: C.text, fontSize: 18, lineHeight: 19 },
  description: {
    minHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    color: C.text,
    fontSize: 14,
    padding: 14,
  },
  saveButton: {
    minHeight: 58,
    marginTop: 26,
    borderRadius: 18,
    backgroundColor: "#F4F6F8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#071019", fontSize: 16, fontWeight: "600" },
  saveArrow: { color: "#071019", fontSize: 23, marginLeft: 10 },
  disabled: { opacity: 0.55 },

  scannerRoot: { flex: 1, backgroundColor: "#000" },
  scannerShadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: "rgba(0,0,0,0.64)",
  },
  closeScanner: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
  },
  closeScannerText: { color: "#FFF", fontSize: 14, fontWeight: "500" },
  scannerTitle: { color: "#FFF", fontSize: 28, fontWeight: "600", marginTop: 24 },
  scannerSub: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 19, marginTop: 8 },
  scanFrame: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "39%",
    height: 190,
  },
  corner: { position: "absolute", width: 42, height: 42, borderColor: "#FFF" },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4 },
  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    top: "50%",
    height: 2,
    backgroundColor: "#3B82F6",
  },
  scannerBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 44,
    paddingTop: 24,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  scannerBottomText: { color: "rgba(255,255,255,0.68)", fontSize: 11 },
});
