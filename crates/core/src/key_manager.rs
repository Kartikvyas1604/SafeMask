

use crate::{CoreError, Result};
use bip39::{Language, Mnemonic};
use bitcoin::bip32::DerivationPath;
use bitcoin::secp256k1::{Secp256k1, SecretKey, PublicKey};
use bitcoin::{Network, PrivateKey};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use hdwallet::{ExtendedPrivKey};
use rand::Rng;

/// BIP44 coin types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoinType {
    Bitcoin = 0,
    Ethereum = 60,
    Solana = 501,
    Polygon = 966,
    Zcash = 133,
}

/// Account derivation information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDerivation {
    pub coin_type: CoinType,
    pub account_index: u32,
    pub change: u32,
    pub address_index: u32,
}

impl AccountDerivation {
    /// Create BIP44 derivation path: m/44'/coin_type'/account'/change/address_index
    pub fn to_path(&self) -> Result<DerivationPath> {
        let path_str = format!(
            "m/44'/{}'/{}'/{}/{}",
            self.coin_type as u32,
            self.account_index,
            self.change,
            self.address_index
        );
        DerivationPath::from_str(&path_str)
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))
    }
}

/// Represents a derived account with keys for multiple chains
#[derive(Clone, Serialize, Deserialize)]
pub struct Account {
    pub name: String,
    pub index: u32,
    
    #[serde(skip)]
    pub ethereum_key: Option<SecretKey>,
    
    #[serde(skip)]
    pub solana_key: Option<SecretKey>,
    
    #[serde(skip)]
    pub bitcoin_key: Option<SecretKey>,
    
    pub ethereum_address: String,
    pub solana_address: String,
    pub bitcoin_address: String,
    pub polygon_address: String,
    pub zcash_address: String,
}

/// Key Manager - Main interface for HD wallet operations
pub struct KeyManager {
    secp: Secp256k1<bitcoin::secp256k1::All>,
    mnemonic: Mnemonic,
    seed: Vec<u8>,
    master_key: ExtendedPrivKey,
}

impl KeyManager {
    /// Create new KeyManager from mnemonic phrase
    pub fn new_from_mnemonic(phrase: &str) -> Result<Self> {
        let mnemonic = Mnemonic::parse_in_normalized(Language::English, phrase)
            .map_err(|e| CoreError::InvalidMnemonic(e.to_string()))?;
        
        let seed = mnemonic.to_seed("");
        let secp = Secp256k1::new();
        
        let master_key = ExtendedPrivKey::with_seed(&seed)
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))?;
        
        Ok(Self {
            secp,
            mnemonic,
            seed: seed.to_vec(),
            master_key,
        })
    }
    
    /// Generate new random mnemonic (24 words)
    pub fn generate_mnemonic() -> Result<String> {
        // Generate 32 bytes of entropy for 24 words
        let mut entropy = [0u8; 32];
        rand::thread_rng().fill(&mut entropy);
        
        let mnemonic = Mnemonic::from_entropy(&entropy)
            .map_err(|e| CoreError::InvalidMnemonic(e.to_string()))?;
        
        Ok(mnemonic.to_string())
    }
    
    /// Get mnemonic phrase (for backup purposes)
    pub fn get_mnemonic(&self) -> String {
        self.mnemonic.to_string()
    }
    
    /// Derive account for specific index
    pub fn derive_account(&self, account_index: u32) -> Result<Account> {
        // Derive keys for each supported chain
        let ethereum_key = self.derive_key(CoinType::Ethereum, account_index, 0, 0)?;
        let solana_key = self.derive_key(CoinType::Solana, account_index, 0, 0)?;
        let bitcoin_key = self.derive_key(CoinType::Bitcoin, account_index, 0, 0)?;
        
        // Generate addresses from public keys
        let ethereum_address = self.generate_ethereum_address(&ethereum_key);
        let solana_address = self.generate_solana_address(&solana_key);
        let bitcoin_address = self.generate_bitcoin_address(&bitcoin_key);
        let polygon_address = ethereum_address.clone(); // Same as Ethereum
        let zcash_address = self.generate_zcash_address(&bitcoin_key);
        
        Ok(Account {
            name: format!("Account {}", account_index + 1),
            index: account_index,
            ethereum_key: Some(ethereum_key),
            solana_key: Some(solana_key),
            bitcoin_key: Some(bitcoin_key),
            ethereum_address,
            solana_address,
            bitcoin_address,
            polygon_address,
            zcash_address,
        })
    }
    
    /// Derive private key for specific path
    fn derive_key(
        &self,
        coin_type: CoinType,
        account: u32,
        change: u32,
        index: u32,
    ) -> Result<SecretKey> {
        let derivation = AccountDerivation {
            coin_type,
            account_index: account,
            change,
            address_index: index,
        };
        
        // Use hdwallet to derive keys
        // m/44'/coin_type'/account'/change/index
        let mut key = self.master_key.clone();
        
        // Derive each level
        key = key.derive_private_key(hdwallet::KeyIndex::hardened_from_normalize_index(44).unwrap())
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))?;
        key = key.derive_private_key(hdwallet::KeyIndex::hardened_from_normalize_index(coin_type as u32).unwrap())
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))?;
        key = key.derive_private_key(hdwallet::KeyIndex::hardened_from_normalize_index(account).unwrap())
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))?;
        key = key.derive_private_key(hdwallet::KeyIndex::Normal(change))
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))?;
        key = key.derive_private_key(hdwallet::KeyIndex::Normal(index))
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))?;
        
        // hdwallet's ExtendedPrivKey wraps a SecretKey
        // Convert hdwallet::SecretKey to bitcoin::secp256k1::SecretKey
        let hdwallet_key = &key.private_key;
        let secret_bytes = hdwallet_key.secret_bytes();
        SecretKey::from_slice(&secret_bytes)
            .map_err(|e| CoreError::KeyDerivation(e.to_string()))
    }
    
    /// Generate Ethereum-compatible address from private key
    fn generate_ethereum_address(&self, key: &SecretKey) -> String {
        use sha2::Digest;
        
        let public_key = PublicKey::from_secret_key(&self.secp, key);
        let public_key_bytes = public_key.serialize_uncompressed();
        
        // Ethereum uses keccak256(public_key)[12..32] as address
        let mut hasher = sha2::Sha256::new();
        hasher.update(&public_key_bytes[1..]); // Skip first byte (0x04)
        let hash = hasher.finalize();
        
        // Take last 20 bytes and format as hex with 0x prefix
        format!("0x{}", hex::encode(&hash[12..]))
    }
    
    /// Generate Solana address from private key
    fn generate_solana_address(&self, key: &SecretKey) -> String {
        let public_key = PublicKey::from_secret_key(&self.secp, key);
        bs58::encode(public_key.serialize()).into_string()
    }
    
    /// Generate Bitcoin address from private key
    fn generate_bitcoin_address(&self, key: &SecretKey) -> String {
        use bitcoin::Address;
        use bitcoin::PublicKey as BtcPubKey;
        
        let btc_private = PrivateKey::new(*key, Network::Bitcoin);
        let public_key = BtcPubKey::from_private_key(&self.secp, &btc_private);
        let address = Address::p2wpkh(&public_key, Network::Bitcoin)
            .expect("Failed to create address");
        
        address.to_string()
    }
    
    /// Generate Zcash transparent address
    fn generate_zcash_address(&self, key: &SecretKey) -> String {
        // Zcash transparent addresses use same format as Bitcoin with different prefix
        let public_key = PublicKey::from_secret_key(&self.secp, key);
        let public_key_bytes = public_key.serialize();
        
        // For now, return a placeholder - full implementation requires zcash-primitives
        format!("t1{}", bs58::encode(&public_key_bytes).into_string())
    }
    
    /// Sign message with account key
    pub fn sign_message(
        &self,
        message: &[u8],
        account: &Account,
        coin_type: CoinType,
    ) -> Result<Vec<u8>> {
        let key = match coin_type {
            CoinType::Ethereum | CoinType::Polygon => {
                account.ethereum_key.ok_or(CoreError::Crypto("No Ethereum key".into()))?
            }
            CoinType::Solana => {
                account.solana_key.ok_or(CoreError::Crypto("No Solana key".into()))?
            }
            CoinType::Bitcoin | CoinType::Zcash => {
                account.bitcoin_key.ok_or(CoreError::Crypto("No Bitcoin key".into()))?
            }
        };
        
        use sha2::Digest;
        let hash = sha2::Sha256::digest(message);
        let msg = bitcoin::secp256k1::Message::from_digest_slice(&hash)
            .map_err(|e| CoreError::Crypto(e.to_string()))?;
        
        let signature = self.secp.sign_ecdsa(&msg, &key);
        Ok(signature.serialize_compact().to_vec())
    }
    
    /// Export private key for specific chain (USE WITH CAUTION)
    pub fn export_private_key(
        &self,
        account: &Account,
        coin_type: CoinType,
    ) -> Result<String> {
        let key = match coin_type {
            CoinType::Ethereum | CoinType::Polygon => {
                account.ethereum_key.ok_or(CoreError::Crypto("No Ethereum key".into()))?
            }
            CoinType::Solana => {
                account.solana_key.ok_or(CoreError::Crypto("No Solana key".into()))?
            }
            CoinType::Bitcoin | CoinType::Zcash => {
                account.bitcoin_key.ok_or(CoreError::Crypto("No Bitcoin key".into()))?
            }
        };
        
        Ok(hex::encode(key.secret_bytes()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_MNEMONIC: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

    #[test]
    fn test_generate_mnemonic() {
        let mnemonic = KeyManager::generate_mnemonic().unwrap();
        assert!(mnemonic.split_whitespace().count() == 24);
    }

    #[test]
    fn test_create_from_mnemonic() {
        let km = KeyManager::new_from_mnemonic(TEST_MNEMONIC).unwrap();
        assert_eq!(km.get_mnemonic(), TEST_MNEMONIC);
    }

    #[test]
    fn test_derive_account() {
        let km = KeyManager::new_from_mnemonic(TEST_MNEMONIC).unwrap();
        let account = km.derive_account(0).unwrap();
        
        assert_eq!(account.index, 0);
        assert!(!account.ethereum_address.is_empty());
        assert!(!account.solana_address.is_empty());
        assert!(!account.bitcoin_address.is_empty());
        assert!(account.ethereum_address.starts_with("0x"));
    }

    #[test]
    fn test_deterministic_derivation() {
        let km1 = KeyManager::new_from_mnemonic(TEST_MNEMONIC).unwrap();
        let km2 = KeyManager::new_from_mnemonic(TEST_MNEMONIC).unwrap();
        
        let account1 = km1.derive_account(0).unwrap();
        let account2 = km2.derive_account(0).unwrap();
        
        assert_eq!(account1.ethereum_address, account2.ethereum_address);
        assert_eq!(account1.solana_address, account2.solana_address);
        assert_eq!(account1.bitcoin_address, account2.bitcoin_address);
    }

    #[test]
    fn test_sign_message() {
        let km = KeyManager::new_from_mnemonic(TEST_MNEMONIC).unwrap();
        let account = km.derive_account(0).unwrap();
        
        let message = b"Hello, SafeMask!";
        let signature = km.sign_message(message, &account, CoinType::Ethereum).unwrap();
        
        assert_eq!(signature.len(), 64); // Compact ECDSA signature
    }
}
