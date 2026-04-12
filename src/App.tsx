import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import './App.css';
import { supabase } from "./supabase";
import QRCode from "qrcode";
import {
  ArrowUpCircle,
  Download,
  Gavel,
  HeartHandshake,
  LayoutDashboard,
  ListPlus,
  Projector,
  QrCode,
  Search,
  TabletSmartphone,
  TimerReset,
  UserRound,
} from "lucide-react";

type Bid = {
  amount: number;
  bidderNumber: string;
  createdAt: string;
};

type AuctionItem = {
  id: string;
  title: string;
  description: string;
  donorFirstName: string;
  donorLastName: string;
  estimatedRetailValue: number;
  startingBid: number;
  image: string;
  image2?: string;
  bids: Bid[];
  createdAt: string;
};

type SubmissionForm = {
  title: string;
  description: string;
  donorFirstName: string;
  donorLastName: string;
  estimatedRetailValue: string;
  startingBid: string;
  image: string;
  image2: string;
};

type HighestBid = {
  amount: number;
  bidderNumber: string;
  createdAt: string;
  isStartingBid?: boolean;
};

const STORAGE_KEY = "church-silent-auction-demo-v5";
const BIDDER_KEY = "church-silent-auction-bidder-number-v5";
const CHECKIN_KEY = "church-silent-auction-checkin-v5";
const MODE_KEY = "church-silent-auction-mode-v5";
const ADMIN_UNLOCK_KEY = "church-silent-auction-admin-unlocked-v5";
const ADMIN_PASSWORD = "1988";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80";

const seedItems: AuctionItem[] = [
  {
    id: crypto.randomUUID(),
    title: "Homemade Cinnamon Rolls",
    description: "Fresh baked dozen of cinnamon rolls.",
    donorFirstName: "Youth",
    donorLastName: "Volunteer",
    estimatedRetailValue: 25,
    startingBid: 15,
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
    bids: [],
    createdAt: new Date().toISOString(),
  },
];

function generateBidderNumber(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getHighestBid(item: AuctionItem): HighestBid {
  if (!item.bids.length) {
    return {
      amount: Number(item.startingBid),
      bidderNumber: "—",
      createdAt: "",
      isStartingBid: true,
    };
  }

  return [...item.bids].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toNumber(value: string) {
  return Number(value || 0);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseImageUrl(imageUrl: string | null): { image: string; image2?: string } {
  if (!imageUrl) return { image: FALLBACK_IMAGE };
  if (imageUrl.startsWith("[")) {
    try {
      const parsed = JSON.parse(imageUrl) as string[];
      return { image: parsed[0] || FALLBACK_IMAGE, image2: parsed[1] || undefined };
    } catch {
      return { image: imageUrl };
    }
  }
  return { image: imageUrl };
}

function buildWinnerCsv(items: AuctionItem[]) {
  const rows = items.map((item) => {
    const highest = getHighestBid(item);
    const donor = `${item.donorFirstName || ""} ${item.donorLastName || ""}`.trim();
    return [
      `"${item.title.replaceAll('"', '""')}"`,
      highest.amount,
      highest.bidderNumber,
      `"${donor.replaceAll('"', '""')}"`,
    ].join(",");
  });

  return "Item,Winning Bid,Winner Bidder Number,Donor\n" + rows.join("\n");
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "16px",
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  } as React.CSSProperties,
  shell: {
    maxWidth: "1280px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  } as React.CSSProperties,
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
  } as React.CSSProperties,
  button: {
    background: "#0f172a",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,
  buttonSecondary: {
    background: "white",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    boxSizing: "border-box",
    fontSize: "14px",
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: "130px",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    boxSizing: "border-box",
    fontSize: "14px",
    resize: "vertical",
  } as React.CSSProperties,
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    background: "#e2e8f0",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
  } as React.CSSProperties,
  alert: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    padding: "14px 16px",
  } as React.CSSProperties,
};

const Panel = React.forwardRef<HTMLDivElement, { children: React.ReactNode; style?: React.CSSProperties }>(
  ({ children, style }, ref) => <div ref={ref} style={{ ...styles.card, ...style }}>{children}</div>
);

export default function SilentAuction() {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [bidderNumber, setBidderNumber] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [mode, setMode] = useState<"bid" | "donate" | null>(null);
  const [biddingClosed, setBiddingClosed] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [leaderboardNow, setLeaderboardNow] = useState(Date.now());
  const [tabletBidderNumber, setTabletBidderNumber] = useState("");
  const [auctionEndsAt, setAuctionEndsAt] = useState<number>(() => new Date("2026-05-02T19:30:00").getTime());
  const [softCloseWindowMinutes] = useState(2);
  const [softCloseExtensionMinutes] = useState(2);
  const [checkinName, setCheckinName] = useState("");
  const [currentTab, setCurrentTab] = useState("items");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [donationSubmitted, setDonationSubmitted] = useState(false);
  const [donationSubmitting, setDonationSubmitting] = useState(false);
  const [bidFlash, setBidFlash] = useState(false);
  const [bidConfirmPending, setBidConfirmPending] = useState(false);
  const [recentlyBidItemId, setRecentlyBidItemId] = useState<string | null>(null);
  const projectorRef = useRef<HTMLDivElement>(null);
  const [adminBidders, setAdminBidders] = useState<{bidder_number: string, display_name: string}[]>([]);
  const [adminAssignName, setAdminAssignName] = useState("");
  const [adminAssignNumber, setAdminAssignNumber] = useState("");
  const [deepLinkItemId, setDeepLinkItemId] = useState<string | null>(null);

  const [submission, setSubmission] = useState<SubmissionForm>({
    title: "",
    description: "",
    donorFirstName: "",
    donorLastName: "",
    estimatedRetailValue: "",
    startingBid: "",
    image: "",
    image2: "",
  });

const loadItems = useCallback(async () => {
  const { data, error } = await supabase
    .from("items")
    .select(`
      *,
      bids (
        amount,
        bidder_number,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading items from Supabase:", error);
    return;
  }

  const mappedItems: AuctionItem[] = (data || []).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    donorFirstName: item.donor_first_name,
    donorLastName: item.donor_last_name,
    estimatedRetailValue: Number(item.estimated_retail_value || 0),
    startingBid: Number(item.starting_bid || 0),
    ...parseImageUrl(item.image_url),
    bids: (item.bids || []).map((bid: any) => ({
      amount: Number(bid.amount || 0),
      bidderNumber: bid.bidder_number,
      createdAt: bid.created_at,
    })),
    createdAt: item.created_at,
  }));

  if (mappedItems.length > 0) {
    setItems(mappedItems);
  } else {
    setItems(seedItems);
  }
}, []);

const ADMIN_BIDDER_NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1));

const loadAdminBidders = useCallback(async () => {
  const { data } = await supabase
    .from("bidders")
    .select("bidder_number, display_name")
    .in("bidder_number", ADMIN_BIDDER_NUMBERS);
  if (data) setAdminBidders(data);
}, []);

async function handleAdminAssign() {
  if (!adminAssignName.trim() || !adminAssignNumber) {
    setStatusIsError(true); setStatusMessage("Please enter a name and select a number.");
    return;
  }
  const { error } = await supabase
    .from("bidders")
    .insert([{ bidder_number: adminAssignNumber, display_name: adminAssignName.trim() }]);
  if (error) {
    setStatusIsError(true); setStatusMessage("Error assigning bidder: " + error.message);
    return;
  }
  setStatusIsError(false); setStatusMessage(`Bidder #${adminAssignNumber} assigned to ${adminAssignName.trim()}.`);
  setAdminAssignName("");
  setAdminAssignNumber("");
  loadAdminBidders();
}

useEffect(() => {
  const savedCheckin = localStorage.getItem(CHECKIN_KEY);
  const savedBidder = localStorage.getItem(BIDDER_KEY);
  const savedMode = localStorage.getItem(MODE_KEY) as "bid" | "donate" | null;
  const savedAdminUnlocked = localStorage.getItem(ADMIN_UNLOCK_KEY) === "true";

  if (savedCheckin && savedBidder) {
    setCheckedIn(true);
    setBidderNumber(savedBidder);
  }
  if (savedMode) setMode(savedMode);
  setAdminUnlocked(savedAdminUnlocked);

  const params = new URLSearchParams(window.location.search);
  const itemParam = params.get("item");
  if (itemParam) setDeepLinkItemId(itemParam);

  loadItems();
  loadAdminBidders();

  supabase.from("settings").select("bidding_closed").eq("id", 1).single().then(({ data }) => {
    if (data) setBiddingClosed(data.bidding_closed);
  });
}, [loadItems, loadAdminBidders]);

 // Items will be stored in Supabase instead of localStorage.

  useEffect(() => {
    localStorage.setItem(ADMIN_UNLOCK_KEY, String(adminUnlocked));
  }, [adminUnlocked]);

  useEffect(() => {
  const interval = setInterval(() => setLeaderboardNow(Date.now()), 10000);
  return () => clearInterval(interval);
}, []);

useEffect(() => {
  if (checkedIn && !mode) {
    setMode("bid");
    localStorage.setItem(MODE_KEY, "bid");
  }
}, [checkedIn, mode]);

useEffect(() => {
  if (checkedIn && deepLinkItemId && items.length > 0) {
    const item = items.find((i) => i.id === deepLinkItemId);
    if (item) {
      setSelectedItem(item);
      setDeepLinkItemId(null);
    }
  }
}, [checkedIn, deepLinkItemId, items]);

useEffect(() => {
  const channel = supabase
    .channel("auction-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "items" },
      () => {
        loadItems();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bids" },
      (payload: any) => {
        loadItems();
        if (payload.new?.item_id) {
          setRecentlyBidItemId(payload.new.item_id);
          setTimeout(() => setRecentlyBidItemId(null), 3000);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "settings" },
      (payload: any) => {
        setBiddingClosed(payload.new.bidding_closed);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [loadItems]);

  const itemNumberMap = useMemo(() => {
    const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return new Map(sorted.map((item, i) => [item.id, i + 1]));
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return items;
    return items.filter((item) => {
      const donor = `${item.donorFirstName || ""} ${item.donorLastName || ""}`.toLowerCase();
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        donor.includes(term)
      );
    });
  }, [items, search]);

  const itemsWithLeaderStatus = useMemo(() => {
    return items.map((item) => {
      const highest = getHighestBid(item);
      const isWinning = highest.bidderNumber !== "—" && String(highest.bidderNumber) === String(bidderNumber);
      const hasBidOnItem = item.bids.some((bid) => String(bid.bidderNumber) === String(bidderNumber));
      const isOutbid = hasBidOnItem && !isWinning;
      return { ...item, highest, isWinning, isOutbid };
    });
  }, [items, bidderNumber]);

const winningItems = useMemo(
  () => itemsWithLeaderStatus.filter((item) => item.isWinning),
  [itemsWithLeaderStatus]
);

const myItems = useMemo(
  () =>
    itemsWithLeaderStatus.filter((item) =>
      item.bids.some((bid) => String(bid.bidderNumber) === String(bidderNumber))
    ),
  [itemsWithLeaderStatus, bidderNumber]
);

  const checkoutItems = useMemo(() => {
    if (!biddingClosed) return [];
    return items
      .map((item) => ({ ...item, highest: getHighestBid(item) }))
      .filter((item) => item.highest.bidderNumber !== "—" && String(item.highest.bidderNumber) === String(bidderNumber));
  }, [items, bidderNumber, biddingClosed]);

  const checkoutTotal = useMemo(
  () => checkoutItems.reduce((sum, item) => sum + Number(item.highest.amount || 0), 0),
  [checkoutItems]
);

const winningItemsTotal = useMemo(
  () => winningItems.reduce((sum, item) => sum + Number(item.highest.amount || 0), 0),
  [winningItems]
);
  const projectorData = useMemo(() => {
    void leaderboardNow;
    return [...items]
      .map((item) => ({ ...item, highest: getHighestBid(item) }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [items, leaderboardNow]);

  const timeRemainingMs = Math.max(auctionEndsAt - Date.now(), 0);
  const remainingDays = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
  const remainingHours = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const remainingSeconds = Math.floor((timeRemainingMs % (1000 * 60)) / 1000);
  const countdownDisplay = `${remainingDays}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
  const isInSoftCloseWindow = timeRemainingMs > 0 && timeRemainingMs <= softCloseWindowMinutes * 60 * 1000;
const registrationUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://desert-ridge-ward-youth-auction.example";

const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
  registrationUrl
)}`;

async function handleCheckin() {
  if (!checkinName.trim()) {
    setStatusIsError(true); setStatusMessage("First and last name are required.");
    return;
  }

  const existing = localStorage.getItem(BIDDER_KEY);

  if (existing) {
    setStatusIsError(false); setStatusMessage(`You are already registered as bidder #${existing}.`);
    setCheckedIn(true);
    setBidderNumber(existing);
    return;
  }

  const number = generateBidderNumber();

  const { error } = await supabase
    .from("bidders")
    .insert([
      {
        bidder_number: number,
        display_name: checkinName.trim() || null,
      },
    ]);

  if (error) {
    console.error("Error saving bidder to Supabase:", error);
    setStatusIsError(true); setStatusMessage("There was a problem creating your bidder number.");
    return;
  }

  localStorage.setItem(BIDDER_KEY, number);
  localStorage.setItem(CHECKIN_KEY, "true");
  localStorage.setItem(MODE_KEY, "bid");

  setBidderNumber(number);
  setCheckedIn(true);
  setMode("bid");

  setStatusIsError(false); setStatusMessage(
    `Welcome${checkinName ? `, ${checkinName}` : ""}. Your anonymous bidder number is #${number}.`
  );
}

  function chooseMode(nextMode: "bid" | "donate") {
    setMode(nextMode);
    localStorage.setItem(MODE_KEY, nextMode);
  }

  function openBid(item: AuctionItem) {
    setSelectedItem(item);
    setBidAmount(String(getHighestBid(item).amount + 1));
  }

  function applyIncrement(increment: number) {
    if (!selectedItem) return;
    const highest = getHighestBid(selectedItem).amount;
    setBidAmount(String(highest + increment));
    setBidFlash(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setBidFlash(true)));
  }

async function placeBid() {
  if (!selectedItem) return;
  setBidConfirmPending(false);

  if (biddingClosed) {
    setStatusIsError(true); setStatusMessage("Bidding is currently closed.");
    return;
  }

  const amount = Number(bidAmount);
  const highest = getHighestBid(selectedItem).amount;

  if (!amount || amount <= highest) {
    setStatusIsError(true); setStatusMessage(`Bid must be higher than ${formatCurrency(highest)}.`);
    return;
  }

  const bidderToUse = tabletBidderNumber || bidderNumber || "";

  const { data, error } = await supabase
    .from("bids")
    .insert([
      {
        item_id: selectedItem.id,
        bidder_number: bidderToUse,
        amount,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error saving bid to Supabase:", error);
    setStatusIsError(true); setStatusMessage("There was a problem saving your bid. Please try again.");
    return;
  }

  const newBid = {
    amount: Number(data.amount || 0),
    bidderNumber: data.bidder_number,
    createdAt: data.created_at,
  };

  setItems((prev) =>
    prev.map((item) =>
      item.id === selectedItem.id
        ? {
            ...item,
            bids: [...item.bids, newBid],
          }
        : item
    )
  );

  const msRemainingBeforeBid = auctionEndsAt - Date.now();
  if (msRemainingBeforeBid <= softCloseWindowMinutes * 60 * 1000) {
    setAuctionEndsAt(Date.now() + softCloseExtensionMinutes * 60 * 1000);
    setStatusIsError(false); setStatusMessage(
      `Bid placed successfully on ${selectedItem.title}. You are currently winning at ${formatCurrency(
        amount
      )}. Auction extended by ${softCloseExtensionMinutes} minutes.`
    );
  } else {
    setStatusIsError(false); setStatusMessage(
      `Bid placed successfully on ${selectedItem.title}. You are currently winning at ${formatCurrency(
        amount
      )}.`
    );
  }

  setSelectedItem(null);
  setBidAmount("");
  setTabletBidderNumber("");
}

  function handleAdminTabClick() {
    if (adminUnlocked) {
      setCurrentTab("admin");
      return;
    }
    const pwd = window.prompt("Enter admin password");
    if (pwd === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setCurrentTab("admin");
      setStatusIsError(false); setStatusMessage("Admin unlocked.");
    } else if (pwd !== null) {
      setStatusIsError(true); setStatusMessage("Incorrect admin password.");
    }
  }

  async function handleImageUpload(file: File | null | undefined, slot: 1 | 2 = 1) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (slot === 1) setSubmission((prev) => ({ ...prev, image: dataUrl }));
    else setSubmission((prev) => ({ ...prev, image2: dataUrl }));
  }

  async function handleDonationSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (donationSubmitting) return;
  setDonationSubmitting(true);

  const newItem: AuctionItem = {
    id: crypto.randomUUID(),
    title: submission.title.trim(),
    description: submission.description.trim(),
    donorFirstName: submission.donorFirstName.trim(),
    donorLastName: submission.donorLastName.trim(),
    estimatedRetailValue: toNumber(submission.estimatedRetailValue),
    startingBid: toNumber(submission.startingBid),
    image: submission.image || FALLBACK_IMAGE,
    image2: submission.image2 || undefined,
    bids: [],
    createdAt: new Date().toISOString(),
  };

  const missingFields = [];
  if (!newItem.title) missingFields.push("item name");
  if (!newItem.description) missingFields.push("description");
  if (!newItem.donorFirstName) missingFields.push("donor first name");
  if (!newItem.donorLastName) missingFields.push("donor last name");
  if (!newItem.estimatedRetailValue) missingFields.push("estimated retail value");
  if (missingFields.length > 0) {
    setStatusIsError(true); setStatusMessage(`Please fill in the following before submitting: ${missingFields.join(", ")}.`);
    setDonationSubmitting(false);
    return;
  }

  const { data, error } = await supabase
    .from("items")
    .insert([
      {
        title: newItem.title,
        description: newItem.description,
        donor_first_name: newItem.donorFirstName,
        donor_last_name: newItem.donorLastName,
        estimated_retail_value: newItem.estimatedRetailValue,
        starting_bid: newItem.startingBid,
        image_url: newItem.image2
          ? JSON.stringify([newItem.image, newItem.image2])
          : newItem.image,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error saving item to Supabase:", error);
    setStatusIsError(true); setStatusMessage("There was a problem saving your item. Please try again.");
    setDonationSubmitting(false);
    return;
  }

  const savedItem: AuctionItem = {
    id: data.id,
    title: data.title,
    description: data.description,
    donorFirstName: data.donor_first_name,
    donorLastName: data.donor_last_name,
    estimatedRetailValue: Number(data.estimated_retail_value || 0),
    startingBid: Number(data.starting_bid || 0),
    ...parseImageUrl(data.image_url),
    bids: [],
    createdAt: data.created_at,
  };

  setItems((prev) => [savedItem, ...prev]);

  setSubmission({
    title: "",
    description: "",
    donorFirstName: "",
    donorLastName: "",
    estimatedRetailValue: "",
    startingBid: "",
    image: "",
    image2: "",
  });

  setStatusIsError(false); setStatusMessage(`Donation submitted: ${savedItem.title} has been added to the auction.`);
  setDonationSubmitted(true);
}

async function handleResetAuction() {
  const confirmed = window.prompt('This will permanently delete ALL items, bids, and bidders from Supabase. Type "RESET" to confirm.');
  if (confirmed !== "RESET") {
    setStatusIsError(false); setStatusMessage("Reset cancelled.");
    return;
  }

  const { error: bidsError } = await supabase.from("bids").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (bidsError) { setStatusIsError(true); setStatusMessage("Error deleting bids: " + bidsError.message); return; }

  const { error: itemsError } = await supabase.from("items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (itemsError) { setStatusIsError(true); setStatusMessage("Error deleting items: " + itemsError.message); return; }

  setItems([]);
  setStatusIsError(false); setStatusMessage("Auction has been reset. All items and bids have been cleared.");
}

async function downloadItemQRDoc() {
  const realItems = items.filter(i => !seedItems.some(s => s.title === i.title));
  if (realItems.length === 0) {
    setStatusIsError(true); setStatusMessage("No real items to export.");
    return;
  }

  const sorted = [...realItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const numberMap = new Map(sorted.map((item, i) => [item.id, i + 1]));

  const itemSections = await Promise.all(
    realItems.map(async (item) => {
      const itemNum = numberMap.get(item.id);
      const itemUrl = `${registrationUrl}?item=${item.id}`;
      const dataUrl = await QRCode.toDataURL(itemUrl, { width: 300, margin: 2 });
      return `
        <div style="page-break-after:always;text-align:center;padding:60px 40px;font-family:Arial,sans-serif;">
          <div style="font-size:48px;font-weight:700;margin-bottom:8px;">Item #${itemNum}</div>
          <div style="font-size:28px;font-weight:700;margin-bottom:8px;">${item.title}</div>
          <div style="font-size:16px;color:#555;margin-bottom:24px;">${item.description}</div>
          <img src="${dataUrl}" style="width:250px;height:250px;" />
          <p style="color:#888;font-size:13px;margin-top:16px;">Scan to place your bid</p>
        </div>`;
    })
  );

  const html = `<html><body>${itemSections.join("")}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "item-qr-codes.doc";
  a.click();
  URL.revokeObjectURL(url);
}

async function exportWinners() {
  const { data: biddersData, error } = await supabase
    .from("bidders")
    .select("*");

  if (error) {
    console.error("Error loading bidders for winner export:", error);
    setStatusIsError(true); setStatusMessage("There was a problem exporting winners.");
    return;
  }

  const bidderNameMap = new Map(
    (biddersData || []).map((bidder) => [
      String(bidder.bidder_number),
      bidder.display_name || "",
    ])
  );

  const rows = items.map((item) => {
    const highest = getHighestBid(item);
    const donor = `${item.donorFirstName || ""} ${item.donorLastName || ""}`.trim();
    const bidderName =
      highest.bidderNumber && highest.bidderNumber !== "—"
        ? bidderNameMap.get(String(highest.bidderNumber)) || ""
        : "";

    return [
      `"${item.title.replaceAll('"', '""')}"`,
      highest.amount,
      `"${String(highest.bidderNumber || "").replaceAll('"', '""')}"`,
      `"${String(bidderName).replaceAll('"', '""')}"`,
      `"${donor.replaceAll('"', '""')}"`,
    ].join(",");
  });

  const csv =
    "Item,Winning Bid,Winner Bidder Number,Winner Name,Donor\n" +
    rows.join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "auction-winners.csv";
  a.click();
  URL.revokeObjectURL(url);
}

  const totalBids = items.reduce((sum, item) => sum + item.bids.length, 0);
  const totalValue = items.reduce((sum, item) => sum + getHighestBid(item).amount, 0);

  const tabButtonStyle = (tab: string): React.CSSProperties => ({

  ...styles.buttonSecondary,
  background: currentTab === tab ? "#0f172a" : "white",
  color: currentTab === tab ? "white" : "#0f172a",
  padding: "10px 14px",
  minWidth: "130px",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
});

  const actionButtonStyle = (disabled?: boolean): React.CSSProperties => ({
    ...styles.button,
    width: "100%",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  if (!checkedIn) {
    return (
      <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Panel style={{ width: "100%", maxWidth: "420px", padding: "24px" }}>
          <h2 style={{ marginTop: 0 }}>Desert Ridge Ward Youth Auction</h2>
          <p style={{ color: "#475569", fontSize: "14px", lineHeight: 1.5, marginTop: 0, marginBottom: "32px" }}>
            Welcome! This is a silent auction where you can bid on items or make donations to support the youth program.
          </p>
<div style={{ marginBottom: "24px" }}>
  <input
    style={styles.input}
    value={checkinName}
    onChange={(e) => setCheckinName(e.target.value)}
    placeholder="Enter your first and last name"
  />
</div>
          <p style={{ color: "#475569", fontSize: "14px", lineHeight: 1.5, marginBottom: "24px" }}>
            No login required. Once you check in, you will be able to donate and/or bid on items. You'll receive an anonymous bidder number that auto-populates when you bid.
          </p>
          <button style={{ ...styles.button, width: "100%" }} onClick={handleCheckin}>Register</button>
          {statusMessage && (
            <p style={{ color: "#dc2626", fontSize: "14px", marginTop: "8px" }}>{statusMessage}</p>
          )}
        </Panel>
      </div>
    );
  }

// Mode selection removed — defaulting to "bid"

  return (
    <div style={styles.page}>
      <div style={styles.shell}>

        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

          <Panel style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "32px" }}>Desert Ridge Ward Youth Auction</h1>
                <p style={{ marginBottom: 0, color: "#475569" }}>Help support the youth by bidding and/or donating items below.</p>
              </div>
              <div style={{ background: "#0f172a", color: "white", borderRadius: "18px", padding: "18px 20px", minWidth: "220px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "#cbd5e1", fontSize: "14px" }}><UserRound size={16} /> Your bidder number</div>``
                <div style={{ marginTop: "6px", fontSize: "32px", fontWeight: 700, letterSpacing: "0.2em" }}>#{bidderNumber}</div>
              </div>
            </div>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "16px" }}>

            {[
  { label: "Items you're winning", value: winningItems.length },
  { label: "Bid total from items you're winning", value: formatCurrency(winningItemsTotal) }
].map((stat) => (
              <Panel key={stat.label} style={{ padding: "16px" }}>
                <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#64748b" }}>{stat.label}</div>
                <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 700 }}>{stat.value}</div>
              </Panel>
            ))}
          </div>
        </div>

        {statusMessage && <div style={{ ...styles.alert, ...(statusIsError ? { background: "#fef2f2", borderColor: "#fca5a5", color: "#b91c1c" } : {}) }}>{statusMessage}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>

            <Panel style={{ padding: "8px", flex: 1, overflowX: "auto" }}>
              <div style={{ display: "flex", gap: "8px", minWidth: "max-content" }}>

<button style={tabButtonStyle("donate")} onClick={() => { setCurrentTab("donate"); setDonationSubmitted(false); }}>
  <ListPlus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
  List/Donate Item
</button>

              <button style={tabButtonStyle("items")} onClick={() => setCurrentTab("items")}>
  <Gavel size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
  Available Items
</button>

<button style={tabButtonStyle("dashboard")} onClick={() => setCurrentTab("dashboard")}>
  <LayoutDashboard size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
  Auction Dashboard
</button>

<button style={tabButtonStyle("myItems")} onClick={() => setCurrentTab("myItems")}>
  <Gavel size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
  My Items
</button>

<button style={tabButtonStyle("checkout")} onClick={() => setCurrentTab("checkout")}>
  <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
  Checkout
</button>


<button style={tabButtonStyle("admin")} onClick={handleAdminTabClick}>
  <TabletSmartphone size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
  ADMIN
</button>
              </div>
            </Panel>

          </div>

          {currentTab === "items" && (
            <>
              <Panel style={{ padding: "16px" }}>
                <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: "420px" }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#94a3b8" }} />
                    <input style={{ ...styles.input, paddingLeft: "34px" }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items or services" />
                  </div>
                  <div style={{ color: "#64748b", fontSize: "14px" }}>{biddingClosed ? "Bidding is currently closed." : "Bidding is currently open."}</div>
                </div>
              </Panel>
              <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {filteredItems.map((item) => {
                  const highest = getHighestBid(item);
                  const isWinning = highest.bidderNumber !== "—" && String(highest.bidderNumber) === String(bidderNumber);
                  const hasBidOnItem = item.bids.some((bid) => String(bid.bidderNumber) === String(bidderNumber));
                  const isOutbid = hasBidOnItem && !isWinning;
                  return (
                    <Panel key={item.id} style={{ overflow: "hidden" }}>
                      <div style={{ display: "flex", overflow: "hidden" }}>
                        <img src={item.image} alt={item.title} style={{ width: item.image2 ? "50%" : "100%", display: "block" }} />
                        {item.image2 && <img src={item.image2} alt={`${item.title} photo 2`} style={{ width: "50%", display: "block", borderLeft: "2px solid #fff" }} />}
                      </div>
                      <div style={{ padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                          <h3 style={{ marginTop: 0 }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "14px", marginRight: "6px" }}>#{itemNumberMap.get(item.id)}</span>
                            {item.title}
                          </h3>
                          <span style={styles.badge}>{item.bids.length ? `${item.bids.length} bids` : "No bids yet"}</span>
                        </div>
                        <p style={{ color: "#475569", fontSize: "14px" }}>{item.description}</p>
                        <p style={{ color: "#94a3b8", fontSize: "15px", marginTop: "4px", marginBottom: "16px" }}>Donated by {item.donorFirstName} {item.donorLastName}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                          <div style={{ background: "#f1f5f9", borderRadius: "12px", padding: "12px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Retail value</div><div style={{ fontSize: "20px", fontWeight: 700 }}>{formatCurrency(item.estimatedRetailValue)}</div></div>
                          <div style={{ background: "#f1f5f9", borderRadius: "12px", padding: "12px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Current highest</div><div style={{ fontSize: "20px", fontWeight: 700 }}>{formatCurrency(highest.amount)}</div></div>
                          <div style={{ background: "#f1f5f9", borderRadius: "12px", padding: "12px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Leading bidder</div><div style={{ fontSize: "20px", fontWeight: 700 }}>{highest.bidderNumber === "—" ? "—" : `#${highest.bidderNumber}`}</div></div>
                        </div>
                        {isWinning && <div style={{ marginTop: "12px", border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: "12px", padding: "12px", fontSize: "14px" }}>You are currently winning this item.</div>}
                        {isOutbid && <div style={{ marginTop: "12px", border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", borderRadius: "12px", padding: "12px", fontSize: "14px" }}>You have been outbid on this item.</div>}
                        <button style={{ ...actionButtonStyle(biddingClosed), marginTop: "14px" }} onClick={() => openBid(item)} disabled={biddingClosed}>Place Bid</button>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </>
          )}

          {currentTab === "dashboard" && (
            <Panel style={{ padding: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Highest bid dashboard</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "720px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ color: "#64748b", fontSize: "14px", textAlign: "left" }}>
                      <th style={{ padding: "8px 16px" }}>Item</th>
                      <th style={{ padding: "8px 16px" }}>Starting Bid</th>
                      <th style={{ padding: "8px 16px" }}>Highest Bid</th>
                      <th style={{ padding: "8px 16px" }}>Highest Bidder #</th>
                      <th style={{ padding: "8px 16px" }}>Bid Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice().sort((a, b) => a.title.localeCompare(b.title)).map((item) => {
                      const highest = getHighestBid(item);
                      return (
                        <tr key={item.id} style={{ background: "#f8fafc" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700 }}>{item.title}</td>
                          <td style={{ padding: "12px 16px" }}>{formatCurrency(item.startingBid)}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 700 }}>{formatCurrency(highest.amount)}</td>
                          <td style={{ padding: "12px 16px" }}>{highest.bidderNumber === "—" ? "—" : `#${highest.bidderNumber}`}</td>
                          <td style={{ padding: "12px 16px" }}>{item.bids.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {currentTab === "projector" && (
            <Panel ref={projectorRef} style={{ background: "#0f172a", color: "white", padding: "0", border: "none", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ textAlign: "center", padding: "28px 32px 24px", position: "relative", background: "#1e293b", borderBottom: "2px solid #334155" }}>
                <button
                  onClick={() => projectorRef.current?.requestFullscreen?.()}
                  style={{ position: "absolute", right: 0, top: 0, ...styles.buttonSecondary, background: "rgba(255,255,255,0.1)", color: "white", borderColor: "rgba(255,255,255,0.2)", fontSize: "13px" }}
                >
                  ⛶ Full Screen
                </button>
                <div style={{ color: "#94a3b8", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: "8px" }}>Desert Ridge Youth — Live Auction Board</div>
                <div style={{ fontSize: "72px", fontWeight: 800, letterSpacing: "0.05em", lineHeight: 1, color: biddingClosed ? "#f87171" : "#ffffff" }}>{countdownDisplay}</div>
                <div style={{ marginTop: "10px", fontSize: "18px", fontWeight: 600, color: biddingClosed ? "#f87171" : "#4ade80" }}>
                  {biddingClosed ? "BIDDING CLOSED" : "BIDDING OPEN"}
                </div>
                {isInSoftCloseWindow && <div style={{ marginTop: "12px", display: "inline-block", border: "1px solid rgba(251,191,36,0.5)", background: "rgba(251,191,36,0.1)", color: "#fde68a", borderRadius: "12px", padding: "8px 16px", fontSize: "14px" }}>Soft-close active — new bids extend by {softCloseExtensionMinutes} min</div>}
              </div>


              {/* Scrolling items */}
              <div className="projector-scroll-container" style={{ height: "600px", padding: "16px 32px 0" }}>
                <div
                  className="projector-scroll-inner"
                  style={{ animationDuration: `${projectorData.length * 8}s` }}
                >
                  {[...projectorData, ...projectorData].map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className={`projector-item${recentlyBidItemId === item.id ? " bid-flash" : ""}`}
                      style={{ display: "grid", gridTemplateColumns: "60px 1.6fr 1fr 1fr", gap: "16px", alignItems: "center", borderRadius: "18px", padding: "18px 24px", marginBottom: "10px" }}
                    >
                      <div style={{ fontSize: "28px", fontWeight: 700, color: "#475569" }}>#{itemNumberMap.get(item.id) ?? index + 1}</div>
                      <div>
                        <div style={{ fontSize: "26px", fontWeight: 700 }}>{item.title}</div>
                        <div style={{ color: "#94a3b8", fontSize: "14px", marginTop: "2px" }}>Starting at {formatCurrency(item.startingBid)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.15em" }}>High Bid</div>
                        <div style={{ fontSize: "30px", fontWeight: 700, color: "#4ade80" }}>{formatCurrency(item.highest.amount)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.15em" }}>Bidder #</div>
                        <div style={{ fontSize: "30px", fontWeight: 700 }}>{item.highest.bidderNumber === "—" ? "—" : `#${item.highest.bidderNumber}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}

          {currentTab === "donate" && (
            <Panel style={{ padding: "20px" }}>
              {donationSubmitted ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
                  <h3 style={{ marginTop: 0, fontSize: "24px" }}>Thanks for your donation!</h3>
                  <p style={{ color: "#475569", fontSize: "16px", marginBottom: "24px" }}>You can now view your item in the Available Items section.</p>
                  <button style={styles.button} onClick={() => { setDonationSubmitted(false); setCurrentTab("items"); }}>View Available Items</button>
                  <button style={{ ...styles.buttonSecondary, marginLeft: "12px" }} onClick={() => setDonationSubmitted(false)}>Donate Another Item</button>
                </div>
              ) : (
              <>
              <h3 style={{ marginTop: 0 }}>List an Item or Service</h3>
              <form onSubmit={handleDonationSubmit} style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Item name <span style={{ color: "#ef4444" }}>*</span></label><input style={styles.input} value={submission.title} onChange={(e) => setSubmission((prev) => ({ ...prev, title: e.target.value }))} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Description <span style={{ color: "#ef4444" }}>*</span></label><textarea style={styles.textarea} value={submission.description} onChange={(e) => setSubmission((prev) => ({ ...prev, description: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Donor first name <span style={{ color: "#ef4444" }}>*</span></label><input style={styles.input} value={submission.donorFirstName} onChange={(e) => setSubmission((prev) => ({ ...prev, donorFirstName: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Donor last name <span style={{ color: "#ef4444" }}>*</span></label><input style={styles.input} value={submission.donorLastName} onChange={(e) => setSubmission((prev) => ({ ...prev, donorLastName: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Estimated retail value <span style={{ color: "#ef4444" }}>*</span></label><input style={styles.input} type="number" min="1" value={submission.estimatedRetailValue} onChange={(e) => setSubmission((prev) => ({ ...prev, estimatedRetailValue: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Starting bid <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label><input style={styles.input} type="number" min="0" value={submission.startingBid} onChange={(e) => setSubmission((prev) => ({ ...prev, startingBid: e.target.value }))} /></div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Item photos (optional)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                    {/* Photo 1 */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "#475569", fontWeight: 500 }}>Photo 1</p>
                      {submission.image && <img src={submission.image} alt="Preview 1" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0" }} />}
                      <label style={{ display: "inline-block", padding: "8px 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "14px", textAlign: "center" }}>
                        {submission.image ? "Change photo" : "Choose photo"}
                        <input type="file" accept="image/*" onChange={async (e) => handleImageUpload(e.target.files?.[0], 1)} style={{ display: "none" }} />
                      </label>
                      {submission.image && <button type="button" onClick={() => setSubmission((prev) => ({ ...prev, image: "" }))} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: 0, textAlign: "left" }}>Remove</button>}
                    </div>
                    {/* Photo 2 */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "#475569", fontWeight: 500 }}>Photo 2 (optional)</p>
                      {submission.image2 && <img src={submission.image2} alt="Preview 2" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0" }} />}
                      <label style={{ display: "inline-block", padding: "8px 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "14px", textAlign: "center" }}>
                        {submission.image2 ? "Change photo" : "Choose photo"}
                        <input type="file" accept="image/*" onChange={async (e) => handleImageUpload(e.target.files?.[0], 2)} style={{ display: "none" }} />
                      </label>
                      {submission.image2 && <button type="button" onClick={() => setSubmission((prev) => ({ ...prev, image2: "" }))} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: 0, textAlign: "left" }}>Remove</button>}
                    </div>
                  </div>
                  <p style={{ color: "#64748b", fontSize: "12px", marginTop: "8px" }}>Choose from your photo library, gallery, or take a new photo with your camera.</p>
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><button type="submit" style={{ ...styles.button, opacity: donationSubmitting ? 0.6 : 1, cursor: donationSubmitting ? "not-allowed" : "pointer" }} disabled={donationSubmitting}>{donationSubmitting ? "Submitting…" : "Submit Donation"}</button></div>
              </form>
              </>
              )}
            </Panel>
          )}

          {currentTab === "register" && (
            <Panel style={{ padding: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Registration QR Code</h3>
              <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "280px 1fr", alignItems: "center" }}>
                <div
  style={{
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #cbd5e1",
    borderRadius: "24px",
    background: "#ffffff",
    padding: "16px",
  }}
>
  <img
    src={qrCodeImageUrl}
    alt="Registration QR Code"
    style={{ width: "100%", maxWidth: "260px", height: "auto", borderRadius: "12px" }}
  />
</div>
                <div>
                  <p style={{ color: "#475569" }}>Print this page or display it at the event entrance so guests can scan the code, open the site, and register for an anonymous bidder number.</p>
                  <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Registration URL</div><div style={{ marginTop: "4px", fontWeight: 700, wordBreak: "break-all" }}>{registrationUrl}</div></div>
                  <p style={{ color: "#64748b", fontSize: "14px" }}>
  This QR code is automatically generated from your current live website URL.
</p>
                </div>
              </div>
            </Panel>
          )}

          {currentTab === "itemqr" && (
            <Panel style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Item QR Codes</h3>
                <button style={styles.button} onClick={downloadItemQRDoc}>
                  <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Download Word Doc
                </button>
              </div>
              <p style={{ color: "#475569", fontSize: "14px", marginBottom: "20px" }}>Print and place these QR codes next to each physical item. Scanning will take bidders directly to that item's bidding screen.</p>
              {items.filter(i => !seedItems.some(s => s.title === i.title)).length === 0 && (
                <p style={{ color: "#94a3b8" }}>No real items in the database yet. Add items first.</p>
              )}
              <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {items.filter(i => !seedItems.some(s => s.title === i.title)).map((item) => {
                  const itemUrl = `${registrationUrl}?item=${item.id}`;
                  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(itemUrl)}`;
                  return (
                    <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", textAlign: "center", background: "#fff" }}>
                      <img src={qr} alt={`QR for ${item.title}`} style={{ width: "160px", height: "160px" }} />
                      <div style={{ marginTop: "10px", fontWeight: 700, fontSize: "14px" }}>{item.title}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", wordBreak: "break-all" }}>{itemUrl}</div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {currentTab === "admin" && (
            <Panel style={{ padding: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Admin Controls</h3>

<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
  <button style={styles.buttonSecondary} onClick={() => setCurrentTab("projector")}>
    <Projector size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
    Live Auction Board
  </button>

  <button style={styles.buttonSecondary} onClick={() => setCurrentTab("register")}>
    <QrCode size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
    Registration QR Code
  </button>

  <button style={styles.buttonSecondary} onClick={() => setCurrentTab("itemqr")}>
    <QrCode size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
    Item QR Codes
  </button>

  <button style={styles.buttonSecondary} onClick={async () => {
    const next = !biddingClosed;
    await supabase.from("settings").update({ bidding_closed: next }).eq("id", 1);
  }}>
    {biddingClosed ? "Reopen Bidding" : "Close Bidding"}
  </button>

  <button style={styles.buttonSecondary} onClick={exportWinners}>
    <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
    Export Winners
  </button>

  <button style={{ ...styles.buttonSecondary, borderColor: "#fca5a5", color: "#dc2626" }} onClick={handleResetAuction}>
    Reset Auction
  </button>
</div>

<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
  <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "10px 12px", color: "#475569", fontSize: "14px" }}>
    Auction status: <strong>{biddingClosed ? "Closed" : "Open"}</strong>
  </div>
  <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "10px 12px", color: "#475569", fontSize: "14px" }}>
    Time left: <strong>{countdownDisplay}</strong>
  </div>
</div>
              <div style={{ marginTop: "16px", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontWeight: 700 }}><TimerReset size={16} /> Auction Timing</div>
                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "12px" }}><div style={{ color: "#64748b", fontSize: "12px", textTransform: "uppercase" }}>Time Remaining</div><div style={{ marginTop: "4px", fontSize: "18px", fontWeight: 700 }}>{countdownDisplay}</div></div>
                  <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "12px" }}><div style={{ color: "#64748b", fontSize: "12px", textTransform: "uppercase" }}>Soft-Close Window</div><div style={{ marginTop: "4px", fontSize: "24px", fontWeight: 700 }}>{softCloseWindowMinutes} min</div></div>
                  <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "12px" }}><div style={{ color: "#64748b", fontSize: "12px", textTransform: "uppercase" }}>Extension</div><div style={{ marginTop: "4px", fontSize: "24px", fontWeight: 700 }}>+{softCloseExtensionMinutes} min</div></div>
                </div>
              </div>

              <div style={{ marginTop: "16px", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>Manual Bidder Assignment</div>
                <p style={{ color: "#475569", fontSize: "14px", marginTop: 0, marginBottom: "16px" }}>Assign bidder numbers 1–20 to guests who prefer not to use the website. Use "Bid for them" to submit bids on their behalf.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: "12px", alignItems: "end", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Guest Name</label>
                    <input style={styles.input} value={adminAssignName} onChange={(e) => setAdminAssignName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Bidder Number</label>
                    <select style={{ ...styles.input, cursor: "pointer" }} value={adminAssignNumber} onChange={(e) => setAdminAssignNumber(e.target.value)}>
                      <option value="">Select...</option>
                      {ADMIN_BIDDER_NUMBERS.filter(n => !adminBidders.some(b => String(b.bidder_number) === n)).map(n => (
                        <option key={n} value={n}>#{n}</option>
                      ))}
                    </select>
                  </div>
                  <button style={styles.button} onClick={handleAdminAssign}>Assign</button>
                </div>
                {adminBidders.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ background: "#f8fafc", color: "#64748b", fontSize: "14px" }}>
                        <tr>
                          <th style={{ padding: "10px 14px", textAlign: "left" }}>#</th>
                          <th style={{ padding: "10px 14px", textAlign: "left" }}>Name</th>
                          <th style={{ padding: "10px 14px", textAlign: "left" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...adminBidders].sort((a, b) => Number(a.bidder_number) - Number(b.bidder_number)).map(bidder => (
                          <tr key={bidder.bidder_number} style={{ borderTop: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 700 }}>#{bidder.bidder_number}</td>
                            <td style={{ padding: "10px 14px" }}>{bidder.display_name || "—"}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <button style={styles.buttonSecondary} onClick={() => { setTabletBidderNumber(bidder.bidder_number); setCurrentTab("items"); }}>
                                Bid for them
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {currentTab === "myItems" && (
  <Panel style={{ padding: "20px" }}>
    <h3 style={{ marginTop: 0 }}>My Items</h3>
    {myItems.length === 0 ? (
      <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "24px", color: "#475569" }}>
        Items you bid on will show up here.
      </div>
    ) : (
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "16px" }}>
        <table style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc", color: "#64748b", fontSize: "14px" }}>
            <tr>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Item</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Highest Bid</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Your Highest Bid</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Total Number of Bids</th>
            </tr>
          </thead>
          <tbody>
            {myItems.map((item) => {
              const userBids = item.bids.filter(
                (bid) => String(bid.bidderNumber) === String(bidderNumber)
              );
              const yourHighestBid = userBids.length
                ? Math.max(...userBids.map((bid) => bid.amount))
                : 0;

              return (
                <tr key={item.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                    <span style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }} onClick={() => { setCurrentTab("items"); openBid(item); }}>{item.title}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {item.isWinning ? "Winning" : "Outbid"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {formatCurrency(item.highest.amount)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {formatCurrency(yourHighestBid)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{item.bids.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Panel>
)}

          {currentTab === "checkout" && (
            <Panel style={{ padding: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Auction Checkout</h3>
              {!biddingClosed ? <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: "16px", padding: "20px" }}>Checkout will appear automatically after the auction is closed.</div> : checkoutItems.length === 0 ? <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}><div style={{ background: "#f8fafc", borderRadius: "16px", padding: "20px", color: "#475569" }}>No winning items were found for bidder #{bidderNumber}.</div><div style={{ border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Bidder Number</div><div style={{ marginTop: "4px", fontSize: "28px", fontWeight: 700 }}>#{bidderNumber}</div><div style={{ marginTop: "12px", color: "#64748b", fontSize: "14px" }}>Total Due</div><div style={{ marginTop: "4px", fontSize: "38px", fontWeight: 700 }}>$0</div></div></div> : <><div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 280px" }}><div style={{ border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Bidder Number</div><div style={{ marginTop: "4px", fontSize: "34px", fontWeight: 700 }}>#{bidderNumber}</div><div style={{ marginTop: "14px", color: "#64748b", fontSize: "14px" }}>Items Won</div><div style={{ marginTop: "4px", fontSize: "28px", fontWeight: 700 }}>{checkoutItems.length}</div></div><div style={{ background: "#0f172a", color: "white", borderRadius: "16px", padding: "20px" }}><div style={{ color: "#cbd5e1", fontSize: "14px" }}>Total Due</div><div style={{ marginTop: "8px", fontSize: "42px", fontWeight: 700 }}>{formatCurrency(checkoutTotal)}</div></div></div><div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "16px" }}><table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse" }}><thead style={{ background: "#f8fafc", color: "#64748b", fontSize: "14px" }}><tr><th style={{ padding: "12px 16px", textAlign: "left" }}>Item</th><th style={{ padding: "12px 16px", textAlign: "left" }}>Winning Bid</th><th style={{ padding: "12px 16px", textAlign: "left" }}>Bidder #</th><th style={{ padding: "12px 16px", textAlign: "left" }}>Donor</th></tr></thead><tbody>{checkoutItems.map((item) => <tr key={item.id} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: "12px 16px", fontWeight: 700 }}>{item.title}</td><td style={{ padding: "12px 16px" }}>{formatCurrency(item.highest.amount)}</td><td style={{ padding: "12px 16px" }}>#{item.highest.bidderNumber}</td><td style={{ padding: "12px 16px" }}>{item.donorFirstName} {item.donorLastName}</td></tr>)}</tbody></table></div></>}
              <div style={{ marginTop: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
                <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Want to donate directly to the Desert Ridge Ward youth program?</p>
                <p style={{ margin: "0 0 10px", color: "#475569", fontSize: "14px" }}>You have 2 options:</p>
                <ol style={{ margin: 0, paddingLeft: "20px", color: "#475569", fontSize: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li>Donate through <strong>LDS.ORG/Donations</strong>. Be sure to use the <strong>"Local - Youth Camp Registration"</strong> line item on the donation slip.</li>
                  <li>Send money through <strong>Venmo to Bishop Allen</strong> and label it <strong>Youth Donation</strong>.</li>
                </ol>
              </div>
            </Panel>
          )}
        </div>

        {selectedItem && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }} onClick={() => setSelectedItem(null)}>
            <div style={{ ...styles.card, width: "100%", maxWidth: "560px", padding: "24px" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>Place a bid</h3>
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px" }}><div style={{ color: "#64748b", fontSize: "14px" }}>Item</div><div style={{ fontSize: "20px", fontWeight: 700 }}>{selectedItem.title}</div></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Bidder number</label><input style={{ ...styles.input, background: "#f8fafc" }} value={`#${tabletBidderNumber || bidderNumber || ""}`} readOnly /></div>
                  <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Current highest</label><input style={{ ...styles.input, background: "#f8fafc" }} value={formatCurrency(getHighestBid(selectedItem).amount)} readOnly /></div>
                </div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Your bid amount</label><input className={`bid-amount-input${bidFlash ? " flash" : ""}`} type="number" min={getHighestBid(selectedItem).amount + 1} value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} onAnimationEnd={() => setBidFlash(false)} /><p style={{ color: "#64748b", fontSize: "12px" }}>Bid must be at least {formatCurrency(getHighestBid(selectedItem).amount + 1)}. To enter a custom amount, click into the box above.</p></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>{[1, 5, 10, 20].map((increment) => <button key={increment} type="button" style={styles.buttonSecondary} onClick={() => applyIncrement(increment)}><ArrowUpCircle size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />+{increment}</button>)}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}><button type="button" style={styles.buttonSecondary} onClick={() => setSelectedItem(null)}>Cancel</button><button type="button" style={styles.button} onClick={() => setBidConfirmPending(true)}>Submit Bid</button></div>
              </form>
            </div>
          </div>
        )}

        {bidConfirmPending && selectedItem && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 2000 }}>
            <div style={{ ...styles.card, width: "100%", maxWidth: "420px", padding: "28px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Confirm your bid</h3>
              <p style={{ color: "#475569", marginBottom: "24px" }}>
                Are you sure you want to submit a bid for <strong>{selectedItem.title}</strong> for <strong>{formatCurrency(Number(bidAmount))}</strong>?
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button style={styles.buttonSecondary} onClick={() => setBidConfirmPending(false)}>Go Back</button>
                <button style={styles.button} onClick={() => placeBid()}>Yes, Submit Bid</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
