// src/App.jsx
import './App.css';
import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

function App() {
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Average");
  const [ratingThreshold, setRatingThreshold] = useState("All");
  const [sortBy, setSortBy] = useState("time_desc");
  const [channel, setChannel] = useState("All");
  const [availableChannels, setAvailableChannels] = useState([]);
  const [timeRange, setTimeRange] = useState("all");
  const [approved, setApproved] = useState({});
  const [showInsights, setShowInsights] = useState({});
  const [showOnlyUnpublished, setShowOnlyUnpublished] = useState(false);

  const [trendGrouping, setTrendGrouping] = useState("monthly");
  const [trendTimeRange, setTrendTimeRange] = useState("all");
  const [tenantGrouping, setTenantGrouping] = useState("monthly");
const [tenantTimeRange, setTenantTimeRange] = useState("all");

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const safeAvg = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return arr.reduce((s, v) => s + (Number(v) || 0), 0) / arr.length;
  };

  const getReviewValueByCategory = (review, cat) => {
    const cats = review.categories || [];
    if (!cats.length) return 0;
    if (cat === "Average" || cat === "All Categories") {
      return safeAvg(cats.map((c) => Number(c.rating) || 0));
    }
    const found = cats.find((c) => c.category === cat);
    return found ? Number(found.rating) : 0;
  };

  const getColorForRating = (rating) => {
    if (isNaN(rating)) return "black";
    if (rating < 5) return "red";
    if (rating >= 5 && rating < 7) return "orange";
    if (rating >= 7 && rating <= 8) return "green";
    if (rating >= 9) return "darkblue";
    return "black";
  };

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/reviews/hostaway`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data.result || res.data);
        const normalized = (data || []).map((r) => ({
          ...r,
          categories: r.categories || r.reviewCategory || [],
        }));
        setReviews(normalized);

        const channels = Array.from(new Set((data || []).map((r) => r.channel).filter(Boolean)));
        setAvailableChannels(["All", ...channels]);

        const initApproved = {};
        (data || []).forEach((r) => {
          initApproved[r.id] = r.status === "published";
        });
        setApproved(initApproved);
      })
      .catch((err) => {
        console.error("Failed to load reviews:", err);
      });
  }, []);

  const handleApproveToggle = async (review) => {
    const currentlyPublished = review.status === "published";
    if (currentlyPublished) {
      const ok = window.confirm("Are you sure you want to unpublish this review?");
      if (!ok) return;
    }

    const newStatus = currentlyPublished ? "unpublished" : "published";
    setApproved((prev) => ({ ...prev, [review.id]: newStatus === "published" }));
    setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: newStatus } : r)));

    try {
      await axios.patch(`${BACKEND_URL}/api/reviews/hostaway/${review.id}`, { status: newStatus });
    } catch (err) {
      console.error("Failed to toggle status:", err);
      setApproved((prev) => ({ ...prev, [review.id]: currentlyPublished }));
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: review.status } : r)));
      alert("Failed to update status on backend.");
    }
  };

  useEffect(() => {
    let result = [...reviews];

    if (channel !== "All") result = result.filter((r) => r.channel === channel);
    if (showOnlyUnpublished) result = result.filter((r) => r.status !== "published");

    if (timeRange !== "all") {
      const now = new Date();
      let cutoff = new Date();
      if (timeRange === "7") cutoff.setDate(now.getDate() - 7);
      else if (timeRange === "30") cutoff.setMonth(now.getMonth() - 1);
      else if (timeRange === "90") cutoff.setMonth(now.getMonth() - 3);
      result = result.filter((r) => {
        const d = new Date(r.submittedAt);
        return !isNaN(d) && d >= cutoff;
      });
    }

    if (ratingThreshold !== "All") {
      const thr = Number(ratingThreshold);
      result = result.filter((r) => getReviewValueByCategory(r, selectedCategory) >= thr);
    }

    if (sortBy === "rating_asc") {
      result.sort((a, b) => getReviewValueByCategory(a, selectedCategory) - getReviewValueByCategory(b, selectedCategory));
    } else if (sortBy === "rating_desc") {
      result.sort((a, b) => getReviewValueByCategory(b, selectedCategory) - getReviewValueByCategory(a, selectedCategory));
    } else if (sortBy === "time_asc") {
      result.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    } else {
      result.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }

    setFilteredReviews(result);
  }, [reviews, selectedCategory, ratingThreshold, sortBy, channel, timeRange, showOnlyUnpublished]);

  const buildTrendData = () => {
    let filtered = [...reviews];
    const now = new Date();

    if (trendTimeRange === "6m") {
      const start = new Date(); start.setMonth(now.getMonth() - 6);
      filtered = reviews.filter((r) => new Date(r.submittedAt) >= start);
    } else if (trendTimeRange === "12m") {
      const start = new Date(); start.setMonth(now.getMonth() - 12);
      filtered = reviews.filter((r) => new Date(r.submittedAt) >= start);
    } else if (trendTimeRange === "2024") {
      filtered = reviews.filter((r) => new Date(r.submittedAt).getFullYear() === 2024);
    } else if (trendTimeRange === "2025") {
      filtered = reviews.filter((r) => new Date(r.submittedAt).getFullYear() === 2025);
    }

    const grouped = {};
    filtered.forEach((r) => {
      const d = new Date(r.submittedAt);
      if (isNaN(d)) return;
      let key;
      if (trendGrouping === "daily") {
        key = d.toISOString().slice(0, 10);
      } else if (trendGrouping === "weekly") {
        const wkStart = new Date(d);
        wkStart.setDate(d.getDate() - d.getDay());
        key = wkStart.toISOString().slice(0, 10);
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!grouped[key]) grouped[key] = { sumRating: 0, count: 0 };
      grouped[key].sumRating += getReviewValueByCategory(r, "Average");
      grouped[key].count += 1;
    });

    const arr = Object.entries(grouped).map(([period, v]) => ({
      period,
      avgRating: Number((v.sumRating / v.count).toFixed(2)),
      count: v.count,
    }));

    arr.sort((a, b) => new Date(a.period) - new Date(b.period));
    return arr;
  };

  const buildChannelChartData = () => {
    const listingMap = {};
    reviews.forEach((r) => {
      const name = r.listingName || `listing-${r.id}`;
      const ch = r.channel || "Unknown";
      const key = `${name}::${ch}`;
      if (!listingMap[key]) listingMap[key] = { ratings: [], channel: ch };
      listingMap[key].ratings.push(getReviewValueByCategory(r, "Average"));
    });

    const channelBuckets = {};
    Object.values(listingMap).forEach((l) => {
      const listingAvg = safeAvg(l.ratings);
      const ch = l.channel || "Unknown";
      if (!channelBuckets[ch]) channelBuckets[ch] = { "<5": 0, "5-6": 0, "7-8": 0, "9-10": 0 };
      if (listingAvg < 5) channelBuckets[ch]["<5"]++;
      else if (listingAvg >= 5 && listingAvg < 7) channelBuckets[ch]["5-6"]++;
      else if (listingAvg >= 7 && listingAvg <= 8) channelBuckets[ch]["7-8"]++;
      else channelBuckets[ch]["9-10"]++;
    });

    return Object.entries(channelBuckets).map(([ch, counts]) => ({
      channel: ch,
      "<5": counts["<5"],
      "5-6": counts["5-6"],
      "7-8": counts["7-8"],
      "9-10": counts["9-10"],
    }));
  };
  const buildTenantTrendData = () => {
  let filtered = [...reviews];
  const now = new Date();

  // Apply time range filter
  if (tenantTimeRange === "6m") {
    const start = new Date(); start.setMonth(now.getMonth() - 6);
    filtered = filtered.filter((r) => new Date(r.submittedAt) >= start);
  } else if (tenantTimeRange === "12m") {
    const start = new Date(); start.setMonth(now.getMonth() - 12);
    filtered = filtered.filter((r) => new Date(r.submittedAt) >= start);
  } else if (tenantTimeRange === "2024") {
    filtered = filtered.filter((r) => new Date(r.submittedAt).getFullYear() === 2024);
  } else if (tenantTimeRange === "2025") {
    filtered = filtered.filter((r) => new Date(r.submittedAt).getFullYear() === 2025);
  }

  // Group by chosen period
  const grouped = {};
  filtered.forEach((r) => {
    const d = new Date(r.submittedAt);
    if (isNaN(d)) return;
    let key;
    if (tenantGrouping === "daily") {
      key = d.toISOString().slice(0, 10);
    } else if (tenantGrouping === "weekly") {
      const wkStart = new Date(d);
      wkStart.setDate(d.getDate() - d.getDay());
      key = wkStart.toISOString().slice(0, 10);
    } else if (tenantGrouping === "yearly") {
      key = d.getFullYear().toString();
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!grouped[key]) grouped[key] = { count: 0 };
    grouped[key].count += 1;
  });

  const arr = Object.entries(grouped).map(([period, v]) => ({
    period,
    count: v.count,
  }));

  arr.sort((a, b) => new Date(a.period) - new Date(b.period));
  return arr;
};

const tenantChartData = buildTenantTrendData();

  const trendChartData = buildTrendData();
  const channelChartData = buildChannelChartData();

  return (
    <>
      <header className="sticky-header">
        <div className="header-content">
          <div className="header-logo">
            <h1 className="brand-title">Flex Living</h1>
            <span className="brand-subtitle">Manager Dashboard</span>
          </div>
        </div>
      </header>

      <div id="root">
        {/* Trend Controls */}
        {/* === Tenant Trend Controls === */}
<section style={{ marginBottom: 40 }}>
  <h2 className="section-title">Tenant Trend</h2>
  <p className="section-desc">Number of tenants over time, grouped by day, month, or year.</p>
  <hr style={{ border: 0, height: 1, background: "rgba(0,0,0,0.06)", margin: "16px 0" }} />
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
    <div>
      Group:
      <select value={tenantGrouping} onChange={(e) => setTenantGrouping(e.target.value)} style={{ marginLeft: 8 }}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>
    </div>
    <div>
      Time Range:
      <select value={tenantTimeRange} onChange={(e) => setTenantTimeRange(e.target.value)} style={{ marginLeft: 8 }}>
        <option value="all">All Time</option>
        <option value="6m">Last 6 months</option>
        <option value="12m">Last 12 months</option>
        <option value="2024">2024</option>
        <option value="2025">2025</option>
      </select>
    </div>
  </div>
</section>

{/* === Tenant Trend Chart === */}
<section style={{ marginBottom: 40 }}>
  <div className="card">
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={tenantChartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#0077b6" name="Tenants count" />
      </LineChart>
    </ResponsiveContainer>
  </div>
</section>

        <section style={{ marginBottom: 40 }}>
          <h2 className="section-title">Rating Trend</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              Group:
              <select value={trendGrouping} onChange={(e) => setTrendGrouping(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              Time Range:
              <select value={trendTimeRange} onChange={(e) => setTrendTimeRange(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="all">All Time</option>
                <option value="6m">Last 6 months</option>
                <option value="12m">Last 12 months</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </div>
        </section>

        {/* Average Rating Trend */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="section-title">Average Rating Trend</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis yAxisId="left" domain={[0, 10]} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="avgRating" stroke="#2F4F4F" name="Avg rating" />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke="#82ca9d" name="Reviews count" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Channel Ratings */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="section-title">Channel Ratings Overview</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={channelChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="<5" stackId="a" fill="red" name="< 5" />
                <Bar dataKey="5-6" stackId="a" fill="orange" name="5 – 6" />
                <Bar dataKey="7-8" stackId="a" fill="green" name="7 – 8" />
                <Bar dataKey="9-10" stackId="a" fill="darkblue" name="9 – 10" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Review Filters */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="section-title">Review Filters</h2>
          <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label>
              Category:
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="All Categories">All Categories</option>
                <option value="cleanliness">Cleanliness</option>
                <option value="communication">Communication</option>
                <option value="check-in">Check-in</option>
                <option value="accuracy">Accuracy</option>
              </select>
            </label>
            <label>
              Rating:
              <select value={ratingThreshold} onChange={(e) => setRatingThreshold(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="All">All</option>
                <option value="6">6 above</option>
                <option value="7">7 above</option>
                <option value="8">8 above</option>
                <option value="9">9 above</option>
                <option value="10">10 only</option>
              </select>
            </label>
            <label>
              Channel:
              <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ marginLeft: 8 }}>
                {availableChannels.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </label>
            <label>
              Time Range:
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="all">All Time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <label>
              Sort by:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="time_desc">Newest</option>
                <option value="time_asc">Oldest</option>
                <option value="rating_desc">Highest rating</option>
                <option value="rating_asc">Lowest rating</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" checked={showOnlyUnpublished} onChange={(e) => setShowOnlyUnpublished(e.target.checked)} />
              <span style={{ marginLeft: 6 }}>Show only unpublished</span>
            </label>
          </div>
        </section>

        {/* Reviews */}
        <section>
          <h2 className="section-title">Guest Reviews</h2>
          <p className="section-desc">Showing {filteredReviews.length} reviews based on current filters.</p>
          <div style={{ display: "grid", gap: 0 }}>
            {filteredReviews.map((review, idx) => {
              const cats = review.categories || [];
              const avg = safeAvg(cats.map((c) => Number(c.rating) || 0));
              const insights = (() => {
                const filtered = reviews.filter((r) => r.listingName === review.listingName);
                const total = filtered.length;
                const sum = filtered.reduce((acc, r) => acc + safeAvg(r.categories.map((c) => Number(c.rating) || 0)), 0);
                const counts = {};
                filtered.forEach((rv) => (rv.categories || []).forEach((c) => {
                  counts[c.category] = counts[c.category] || [];
                  counts[c.category].push(Number(c.rating) || 0);
                }));
                const avgRating = total ? (sum / total).toFixed(2) : "N/A";
                let weakest = { category: "None", avg: 0 };
                Object.entries(counts).forEach(([k, arr]) => {
                  const a = safeAvg(arr);
                  if (weakest.category === "None" || a < weakest.avg) weakest = { category: k, avg: a };
                });
                return { avgRating, weakest };
              })();

              return (
                <div key={review.id} style={{ padding: "16px 0", borderBottom: idx !== filteredReviews.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: 16 }}>
                        {review.guestName || "Guest"} — {review.listingName || "Listing"}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {review.submittedAt} — {review.channel}
                      </div>
                      <p style={{ marginTop: 8 }}>{review.publicReview || review.reviewText}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {cats.map((c, i) => (
                          <span key={i} style={{ background: "#f4f4f4", padding: "2px 6px", borderRadius: 4 }}>
                            {c.category}: <span style={{ color: getColorForRating(c.rating) }}>{c.rating}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <button onClick={() => handleApproveToggle(review)}>
                        {approved[review.id] ? "Unapprove" : "Approve"}
                      </button>
                      <button onClick={() => setShowInsights((prev) => ({ ...prev, [review.id]: !prev[review.id] }))}>
                        {showInsights[review.id] ? "Hide Insight" : "Show Insight"}
                      </button>
                    </div>
                  </div>

                  {showInsights[review.id] && (
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      <div>Average rating: {insights.avgRating}</div>
                      <div>
                        Weakest category:
                        <span style={{
                          display: "inline-block",
                          marginLeft: 6,
                          padding: "2px 6px",
                          borderRadius: "12px",
                          color: "white",
                          backgroundColor: getColorForRating(insights.weakest.avg),
                        }}>
                          {insights.weakest.category} ({insights.weakest.avg.toFixed(1)})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

export default App;
