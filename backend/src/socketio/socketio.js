    import { io } from "../index.js";
    import Auction from "../models/auction.model.js";
    import Bid from "../models/bid.model.js";

    export const socketIoConnection = () => {
    let users = [];

    io.on("connection", (socket) => {
        console.log("✅ User connected:", socket.id);

        // Join auction room
        socket.on("joinAuction", (userId) => {
        socket.join(userId);

        const existingUser = users.find((u) => u.userId === userId);
        if (existingUser) {
            existingUser.socketId = socket.id;
        } else {
            users.push({ userId, socketId: socket.id });
        }

        console.log("Active users:", users);
        });

        // Handle new bid
        socket.on("newBid", (data) => {
        console.log("📩 New bid:", data);

        users.forEach((user) => {
            io.to(user.socketId).emit("newBidData", data);
        });
        });

        // Send bid notification
        socket.on("sendNewBidNotification", async (data) => {
        try {
            const auctionData = await Auction.findById(data.auctionId);
            if (!auctionData) return;

            let notification = {
            user: null,
            message: `${data.fullName} has placed a $${data.newBidAmount} bid on ${auctionData.name}`,
            type: "BID_PLACED",
            auction: data.auctionId,
            link: `/single-auction-detail/${data.auctionId}`,
            };

            users.forEach((user) => {
            notification.message = `${
                data.id === user.userId ? "You" : data.fullName
            } placed a $${data.newBidAmount} bid on ${auctionData.name}`;

            io.to(user.socketId).emit("newBidNotification", notification);
            });
        } catch (error) {
            console.error("❌ Error sending bid notification:", error.message);
        }
        });

        // Select auction winner
        socket.on("selectWinner", async (auctionId) => {
        try {
            const bids = await Bid.find({ auction: auctionId });
            if (bids.length === 0) {
            return users.forEach((user) =>
                io.to(user.socketId).emit("winnerSelected", null)
            );
            }

            // Find max bid
            let maxBid = bids.reduce((prev, curr) =>
            curr.bidAmount > prev.bidAmount ? curr : prev
            );

            const auction = await Auction.findById(auctionId);
            const winnerUser = await Bid.findById(maxBid._id).populate(
            "bidder",
            "fullName email phone profilePicture"
            );

            auction.winner = maxBid._id;
            auction.status = "over";
            await auction.save();

            users.forEach((user) => {
            io.to(user.socketId).emit("winnerSelected", winnerUser);
            });
        } catch (error) {
            console.error("❌ Error selecting winner:", error.message);
        }
        });

        // Handle disconnect
        socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
        users = users.filter((user) => user.socketId !== socket.id);
        });
    });
    };
