package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SafeMask/bridge-watcher/internal/bridge"
	"github.com/SafeMask/bridge-watcher/internal/config"
	"github.com/SafeMask/bridge-watcher/internal/relayer"
	"github.com/SafeMask/bridge-watcher/internal/server"
)

func main() {
	log.Println("🌉 Starting SafeMask Bridge Watcher...")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize bridge watcher
	watcher, err := bridge.NewWatcher(cfg)
	if err != nil {
		log.Fatalf("Failed to create bridge watcher: %v", err)
	}

	// Initialize relayer
	rel, err := relayer.NewRelayer(cfg, watcher)
	if err != nil {
		log.Fatalf("Failed to create relayer: %v", err)
	}

	// Initialize HTTP/WebSocket server
	srv := server.NewServer(cfg, watcher, rel)

	// Start services
	go func() {
		if err := watcher.Start(ctx); err != nil {
			log.Printf("Bridge watcher error: %v", err)
		}
	}()

	go func() {
		if err := rel.Start(ctx); err != nil {
			log.Printf("Relayer error: %v", err)
		}
	}()

	go func() {
		if err := srv.Start(); err != nil {
			log.Printf("Server error: %v", err)
		}
	}()

	log.Printf("✅ Bridge watcher started on port %s", cfg.ServerPort)
	log.Printf("📊 Monitoring chains: %v", cfg.ChainIDs)

	// Wait for interrupt signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("🛑 Shutting down gracefully...")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	cancel() // Cancel main context
	time.Sleep(1 * time.Second)

	log.Println("👋 Shutdown complete")
}
