// src/PublicPage.jsx
import './App.css';
import { useEffect, useState } from "react";
import axios from "axios";

export default function PublicPage() {
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);

  // Filters state
  const [ratingThreshold, setRatingThreshold] = useState("All");
  const [sortBy, setSortBy] = useState("time_desc");

  // Calculate average rating for a review
  const getReviewAverage = (review) => {
    if (!review.categories || review.categories.length === 0) return 0;
    const vals = review.categories.map((c) => Number(c.rating) || 0).filter(Boolean);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const getColorClass = (rating) => {
    const r = Number(rating);
    if (isNaN(r)) return "";
    if (r < 5) return "red";
    if (r >= 5 && r < 7) return "orange";
    if (r >= 7 && r <= 8) return "green";
    if (r >= 9) return "darkblue";
    return "";
  };

  useEffect(() => {
    axios
      .get("http://localhost:3001/api/reviews/hostaway")
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : (response.data.result || response.data || []);
        const normalized = (data || []).map((r) => ({
          ...r,
          categories: r.categories || r.reviewCategory || [],
        }));
        // Only published reviews for public page
        setReviews(normalized.filter((r) => r.status === "published"));
      })
      .catch((err) => {
        console.error("Failed to fetch:", err);
      });
  }, []);

  // Apply filtering and sorting whenever reviews, ratingThreshold, or sortBy changes
  useEffect(() => {
    let result = [...reviews];

    // Filter by rating threshold
    if (ratingThreshold !== "All") {
      const threshold = Number(ratingThreshold);
      result = result.filter((r) => getReviewAverage(r) >= threshold);
    }

    // Sort
    if (sortBy === "time_asc") {
      result.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    } else if (sortBy === "time_desc") {
      result.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    } else if (sortBy === "rating_asc") {
      result.sort((a, b) => getReviewAverage(a) - getReviewAverage(b));
    } else if (sortBy === "rating_desc") {
      result.sort((a, b) => getReviewAverage(b) - getReviewAverage(a));
    }

    setFilteredReviews(result);
  }, [reviews, ratingThreshold, sortBy]);

  return (
    <>
      <header className="sticky-header">
        <div className="header-content">
          <div className="header-logo">
            <h1 className="brand-title">Flex Living</h1>
            <span className="brand-subtitle">Guest Reviews</span>
          </div>
        </div>
      </header>

      <main className="app-content" style={{ maxWidth: 900, margin: "auto" }}>
        {/* Section Header */}
        <section style={{ marginBottom: "1.5rem" }}>
          <h2
            style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#2F4F4F" }}
          >
            What Our Guests Say
          </h2>
          <p
            style={{
              marginTop: "0.5rem",
              color: "#666",
              fontSize: "1rem",
              maxWidth: "600px",
            }}
          >
            Browse through real reviews from our valued guests, sharing their honest
            experiences at our properties.
          </p>
        </section>

        {/* Filter Controls */}
        <section
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label>
            Rating:
            <select
              value={ratingThreshold}
              onChange={(e) => setRatingThreshold(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="All">All</option>
              <option value="6">6 and above</option>
              <option value="7">7 and above</option>
              <option value="8">8 and above</option>
              <option value="9">9 and above</option>
              <option value="10">10 only</option>
            </select>
          </label>

          <label>
            Sort by:
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="time_desc">Newest first</option>
              <option value="time_asc">Oldest first</option>
              <option value="rating_desc">Highest rating</option>
              <option value="rating_asc">Lowest rating</option>
            </select>
          </label>
        </section>

        {/* Divider */}
        <hr
          style={{
            border: 0,
            height: 1,
            background: "rgba(0,0,0,0.06)",
            margin: "1.5rem 0",
          }}
        />

        {filteredReviews.length === 0 && (
          <div className="card">
            <p>No reviews available.</p>
          </div>
        )}

        <ul
          style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}
        >
          {filteredReviews.map((review, index) => (
            <li
              key={review.id}
              className={`review-card fade-up`}
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                    {review.guestName || "Guest"}
                    <span style={{ fontWeight: 400, marginLeft: 8, color: "#555" }}>
                      — {review.listingName || "Listing"}
                    </span>
                  </div>

                  <div style={{ color: "#777", fontSize: 13, marginBottom: 8 }}>
                    {review.submittedAt} • {review.channel || "N/A"}
                  </div>

                  <div style={{ color: "#333", lineHeight: 1.5 }}>
                    {review.publicReview || review.reviewText || review.review || "No review text."}
                  </div>

                  {review.categories?.length > 0 && (
                    <div
                      style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
                      {review.categories.map((c, i) => (
                        <span
                          key={i}
                          className={`category-pill ${getColorClass(c.rating)}`}
                        >
                          {c.category}: {c.rating}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right", minWidth: 72 }}>
                  {review.categories?.length > 0 ? (
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937" }}>
                      {(() => {
                        const vals = review.categories
                          .map((c) => Number(c.rating) || 0)
                          .filter(Boolean);
                        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                        return avg ? avg.toFixed(1) : "—";
                      })()}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#777" }}>Rating N/A</div>
                  )}
                  <div style={{ fontSize: 12, color: "#777" }}>Average</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
