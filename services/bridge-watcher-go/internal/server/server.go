package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/SafeMask/bridge-watcher/internal/bridge"
	"github.com/SafeMask/bridge-watcher/internal/config"
	"github.com/SafeMask/bridge-watcher/internal/relayer"
)

type Server struct {
	cfg      *config.Config
	watcher  *bridge.Watcher
	relayer  *relayer.Relayer
	router   *mux.Router
	server   *http.Server
	upgrader websocket.Upgrader
	wsClients map[*websocket.Conn]bool
	wsMu     sync.RWMutex
}

func NewServer(cfg *config.Config, watcher *bridge.Watcher, relayer *relayer.Relayer) *Server {
	s := &Server{
		cfg:      cfg,
		watcher:  watcher,
		relayer:  relayer,
		router:   mux.NewRouter(),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
		},
		wsClients: make(map[*websocket.Conn]bool),
	}

	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	// Health check
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")

	// Status endpoints
	s.router.HandleFunc("/api/v1/status", s.handleStatus).Methods("GET")
	s.router.HandleFunc("/api/v1/status/watcher", s.handleWatcherStatus).Methods("GET")
	s.router.HandleFunc("/api/v1/status/relayer", s.handleRelayerStatus).Methods("GET")

	// Transaction endpoints
	s.router.HandleFunc("/api/v1/transactions/{txHash}", s.handleGetTransaction).Methods("GET")
	s.router.HandleFunc("/api/v1/transactions", s.handleSubmitTransaction).Methods("POST")

	// Bridge endpoints
	s.router.HandleFunc("/api/v1/bridge/events", s.handleGetEvents).Methods("GET")
	s.router.HandleFunc("/api/v1/bridge/status/{chainId}", s.handleChainStatus).Methods("GET")

	// WebSocket endpoint
	s.router.HandleFunc("/ws", s.handleWebSocket)

	// CORS middleware
	s.router.Use(corsMiddleware)

	// Logging middleware
	s.router.Use(loggingMiddleware)
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%s", s.cfg.ServerHost, s.cfg.ServerPort)
	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("🌐 HTTP server starting on %s", addr)
	
	// Start WebSocket broadcaster
	go s.broadcastEvents()

	return s.server.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	log.Println("🛑 Shutting down HTTP server...")
	
	// Close all WebSocket connections
	s.wsMu.Lock()
	for conn := range s.wsClients {
		conn.Close()
	}
	s.wsMu.Unlock()

	return s.server.Shutdown(ctx)
}

// HTTP Handlers

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{
		"status": "healthy",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"watcher": s.watcher.GetStatus(),
		"relayer": s.relayer.GetStatus(),
		"ws_clients": len(s.wsClients),
		"uptime": time.Since(time.Now()), // Would track actual uptime
	}
	respondJSON(w, http.StatusOK, status)
}

func (s *Server) handleWatcherStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, s.watcher.GetStatus())
}

func (s *Server) handleRelayerStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, s.relayer.GetStatus())
}

func (s *Server) handleGetTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	txHash := vars["txHash"]

	tx, ok := s.relayer.GetPendingTx(txHash)
	if !ok {
		respondError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	respondJSON(w, http.StatusOK, tx)
}

func (s *Server) handleSubmitTransaction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChainID     uint64 `json:"chain_id"`
		To          string `json:"to"`
		Amount      string `json:"amount"`
		Commitment  string `json:"commitment"`
		RangeProof  string `json:"range_proof"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate and process transaction
	// This would interact with the relayer to submit the transaction

	respondJSON(w, http.StatusAccepted, map[string]string{
		"status": "accepted",
		"message": "Transaction submitted for relay",
	})
}

func (s *Server) handleGetEvents(w http.ResponseWriter, r *http.Request) {
	// Query parameters
	chainID := r.URL.Query().Get("chain_id")
	limit := r.URL.Query().Get("limit")
	
	// This would query a database of historical events
	events := []map[string]interface{}{
		{
			"chain_id": 1,
			"event_type": "deposit",
			"tx_hash": "0x1234...",
			"timestamp": time.Now(),
		},
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"events": events,
		"count":  len(events),
	})
}

func (s *Server) handleChainStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chainID := vars["chainId"]

	// Get chain-specific status
	status := map[string]interface{}{
		"chain_id": chainID,
		"status": "active",
		"last_block": s.watcher.GetLastBlock(1), // Would parse chainID
	}

	respondJSON(w, http.StatusOK, status)
}

// WebSocket Handlers

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Register client
	s.wsMu.Lock()
	s.wsClients[conn] = true
	s.wsMu.Unlock()

	log.Printf("🔌 New WebSocket client connected (total: %d)", len(s.wsClients))

	// Send welcome message
	conn.WriteJSON(map[string]interface{}{
		"type": "connected",
		"message": "Connected to SafeMask Bridge Watcher",
		"timestamp": time.Now(),
	})

	// Handle incoming messages
	go s.handleWSMessages(conn)
}

func (s *Server) handleWSMessages(conn *websocket.Conn) {
	defer func() {
		s.wsMu.Lock()
		delete(s.wsClients, conn)
		s.wsMu.Unlock()
		conn.Close()
		log.Printf("🔌 WebSocket client disconnected (remaining: %d)", len(s.wsClients))
	}()

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle client messages (ping, subscribe, etc.)
		if msgType, ok := msg["type"].(string); ok {
			switch msgType {
			case "ping":
				conn.WriteJSON(map[string]interface{}{
					"type": "pong",
					"timestamp": time.Now(),
				})
			case "subscribe":
				// Handle subscription to specific chains/events
			}
		}
	}
}

func (s *Server) broadcastEvents() {
	events := s.watcher.GetEvents()
	for event := range events {
		s.wsMu.RLock()
		for conn := range s.wsClients {
			go func(c *websocket.Conn, e *bridge.BridgeEvent) {
				if err := c.WriteJSON(map[string]interface{}{
					"type": "bridge_event",
					"event": e,
					"timestamp": time.Now(),
				}); err != nil {
					log.Printf("WebSocket write error: %v", err)
				}
			}(conn, event)
		}
		s.wsMu.RUnlock()
	}
}

// Middleware

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}

// Helper Functions

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{
		"error": message,
	})
}
