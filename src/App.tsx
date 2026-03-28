import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import './App.css';
import { supabase } from "./supabase";
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
  {
    id: crypto.randomUUID(),
    title: "Yard Cleanup Service",
    description: "Two hours of yard cleanup by the youth group.",
    donorFirstName: "Youth",
    donorLastName: "Group",
    estimatedRetailValue: 60,
    startingBid: 40,
    image:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80",
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
  const [leaderboardNow, setLeaderboardNow] = useState(Date.now());
  const [tabletBidderNumber, setTabletBidderNumber] = useState("");
  const [auctionEndsAt, setAuctionEndsAt] = useState<number>(() => new Date("2026-05-02T19:30:00").getTime());
  const [softCloseWindowMinutes] = useState(2);
  const [softCloseExtensionMinutes] = useState(2);
  const [checkinName, setCheckinName] = useState("");
  const [currentTab, setCurrentTab] = useState("items");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [donationSubmitted, setDonationSubmitted] = useState(false);
  const [bidFlash, setBidFlash] = useState(false);
  const [bidConfirmPending, setBidConfirmPending] = useState(false);
  const [recentlyBidItemId, setRecentlyBidItemId] = useState<string | null>(null);
  const projectorRef = useRef<HTMLDivElement>(null);
  const [adminBidders, setAdminBidders] = useState<{bidder_number: string, display_name: string}[]>([]);
  const [adminAssignName, setAdminAssignName] = useState("");
  const [adminAssignNumber, setAdminAssignNumber] = useState("");

  const [submission, setSubmission] = useState<SubmissionForm>({
    title: "",
    description: "",
    donorFirstName: "",
    donorLastName: "",
    estimatedRetailValue: "",
    startingBid: "",
    image: "",
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
    setItems(seedItems);
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
    image: item.image_url || FALLBACK_IMAGE,
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
    setStatusMessage("Please enter a name and select a number.");
    return;
  }
  const { error } = await supabase
    .from("bidders")
    .insert([{ bidder_number: adminAssignNumber, display_name: adminAssignName.trim() }]);
  if (error) {
    setStatusMessage("Error assigning bidder: " + error.message);
    return;
  }
  setStatusMessage(`Bidder #${adminAssignNumber} assigned to ${adminAssignName.trim()}.`);
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
    setStatusMessage("First and last name are required.");
    return;
  }

  const existing = localStorage.getItem(BIDDER_KEY);

  if (existing) {
    setStatusMessage(`You are already registered as bidder #${existing}.`);
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
    setStatusMessage("There was a problem creating your bidder number.");
    return;
  }

  localStorage.setItem(BIDDER_KEY, number);
  localStorage.setItem(CHECKIN_KEY, "true");
  localStorage.setItem(MODE_KEY, "bid");

  setBidderNumber(number);
  setCheckedIn(true);
  setMode("bid");

  setStatusMessage(
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
    setStatusMessage("Bidding is currently closed.");
    return;
  }

  const amount = Number(bidAmount);
  const highest = getHighestBid(selectedItem).amount;

  if (!amount || amount <= highest) {
    setStatusMessage(`Bid must be higher than ${formatCurrency(highest)}.`);
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
    setStatusMessage("There was a problem saving your bid. Please try again.");
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
    setStatusMessage(
      `Bid placed successfully on ${selectedItem.title}. You are currently winning at ${formatCurrency(
        amount
      )}. Auction extended by ${softCloseExtensionMinutes} minutes.`
    );
  } else {
    setStatusMessage(
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
      setStatusMessage("Admin unlocked.");
    } else if (pwd !== null) {
      setStatusMessage("Incorrect admin password.");
    }
  }

  async function handleImageUpload(file?: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setSubmission((prev) => ({ ...prev, image: dataUrl }));
  }

  async function handleDonationSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  const newItem: AuctionItem = {
    id: crypto.randomUUID(),
    title: submission.title.trim(),
    description: submission.description.trim(),
    donorFirstName: submission.donorFirstName.trim(),
    donorLastName: submission.donorLastName.trim(),
    estimatedRetailValue: toNumber(submission.estimatedRetailValue),
    startingBid: toNumber(submission.startingBid),
    image: submission.image || FALLBACK_IMAGE,
    bids: [],
    createdAt: new Date().toISOString(),
  };

  if (
    !newItem.title ||
    !newItem.description ||
    !newItem.donorFirstName ||
    !newItem.donorLastName ||
    !newItem.estimatedRetailValue ||
    !newItem.startingBid
  ) {
    setStatusMessage("Please complete all donation fields before submitting.");
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
        image_url: newItem.image,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error saving item to Supabase:", error);
    setStatusMessage("There was a problem saving your item. Please try again.");
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
    image: data.image_url || FALLBACK_IMAGE,
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
  });

  setStatusMessage(`Donation submitted: ${savedItem.title} has been added to the auction.`);
  setDonationSubmitted(true);
}

async function handleResetAuction() {
  const confirmed = window.prompt('This will permanently delete ALL items, bids, and bidders from Supabase. Type "RESET" to confirm.');
  if (confirmed !== "RESET") {
    setStatusMessage("Reset cancelled.");
    return;
  }

  const { error: bidsError } = await supabase.from("bids").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (bidsError) { setStatusMessage("Error deleting bids: " + bidsError.message); return; }

  const { error: itemsError } = await supabase.from("items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (itemsError) { setStatusMessage("Error deleting items: " + itemsError.message); return; }

  setItems([]);
  setStatusMessage("Auction has been reset. All items and bids have been cleared.");
}

async function exportWinners() {
  const { data: biddersData, error } = await supabase
    .from("bidders")
    .select("*");

  if (error) {
    console.error("Error loading bidders for winner export:", error);
    setStatusMessage("There was a problem exporting winners.");
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

        {statusMessage && <div style={styles.alert}>{statusMessage}</div>}

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
                      <div style={{ aspectRatio: "4 / 3", background: "#e2e8f0" }}><img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                      <div style={{ padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                          <h3 style={{ marginTop: 0 }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "14px", marginRight: "6px" }}>#{itemNumberMap.get(item.id)}</span>
                            {item.title}
                          </h3>
                          <span style={styles.badge}>{item.bids.length ? `${item.bids.length} bids` : "No bids yet"}</span>
                        </div>
                        <p style={{ color: "#475569", fontSize: "14px" }}>{item.description}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                <table style={{ width: "100%", minWidth: "860px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ color: "#64748b", fontSize: "14px", textAlign: "left" }}>
                      <th style={{ padding: "8px 16px" }}>Item</th>
                      <th style={{ padding: "8px 16px" }}>Retail Value</th>
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
                          <td style={{ padding: "12px 16px" }}>{formatCurrency(item.estimatedRetailValue)}</td>
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
                <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Item name</label><input style={styles.input} value={submission.title} onChange={(e) => setSubmission((prev) => ({ ...prev, title: e.target.value }))} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Description</label><textarea style={styles.textarea} value={submission.description} onChange={(e) => setSubmission((prev) => ({ ...prev, description: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Donor first name</label><input style={styles.input} value={submission.donorFirstName} onChange={(e) => setSubmission((prev) => ({ ...prev, donorFirstName: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Donor last name</label><input style={styles.input} value={submission.donorLastName} onChange={(e) => setSubmission((prev) => ({ ...prev, donorLastName: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Estimated retail value</label><input style={styles.input} type="number" min="1" value={submission.estimatedRetailValue} onChange={(e) => setSubmission((prev) => ({ ...prev, estimatedRetailValue: e.target.value }))} /></div>
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Starting bid</label><input style={styles.input} type="number" min="1" value={submission.startingBid} onChange={(e) => setSubmission((prev) => ({ ...prev, startingBid: e.target.value }))} /></div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Upload item photo (optional)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                   <label className="text-blue-600 underline cursor-pointer w-fit">
  Upload photo
  <input
    type="file"
    accept="image/*"
    capture="environment"
    onChange={async (e) => handleImageUpload(e.target.files?.[0])}
    className="hidden"
  />
</label>
                    <input style={styles.input} placeholder="Or paste an image URL" value={submission.image} onChange={(e) => setSubmission((prev) => ({ ...prev, image: e.target.value }))} />
                    <p style={{ color: "#64748b", fontSize: "12px" }}>You can upload a photo, take one with your camera, or paste a URL.</p>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><button type="submit" style={styles.button}>Submit Donation</button></div>
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
                <div><label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Your bid amount</label><input className={`bid-amount-input${bidFlash ? " flash" : ""}`} type="number" min={getHighestBid(selectedItem).amount + 1} value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} onAnimationEnd={() => setBidFlash(false)} /><p style={{ color: "#64748b", fontSize: "12px" }}>Bid must be at least {formatCurrency(getHighestBid(selectedItem).amount + 1)}.</p></div>
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
