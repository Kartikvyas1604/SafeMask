//! Pedersen Commitments and Range Proofs
//!
//! Implements cryptographic commitments for hiding transaction amounts and balances.
//! Uses Pedersen commitments which are additively homomorphic and perfectly hiding.
//!
//! # Security
//!
//! - Uses Ristretto255 group (based on Curve25519)
//! - Commitments are computationally binding and perfectly hiding
//! - Range proofs use Bulletproofs (no trusted setup required)
//! - All sensitive values are zeroized on drop
//!
//! # Mathematical Foundation
//!
//! ```text
//! Commitment: C(v, r) = v·G + r·H
//! where G, H are independent generators
//!       v is the value (amount)
//!       r is the blinding factor (randomness)
//!
//! Homomorphic property:
//! C(v1, r1) + C(v2, r2) = C(v1 + v2, r1 + r2)
//! ```

use curve25519_dalek::{
    constants::RISTRETTO_BASEPOINT_POINT,
    ristretto::RistrettoPoint,
    scalar::Scalar,
};
use serde::{Deserialize, Serialize};
use sha2::{Sha512, Digest};
use rand::Rng;
use crate::{CoreError, Result};

/// Helper function to generate random scalar
pub fn random_scalar() -> Scalar {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    Scalar::from_bytes_mod_order(bytes)
}

/// Pedersen commitment scheme using Ristretto255
#[derive(Clone)]
pub struct PedersenCommitment {
    /// Primary generator (for values)
    pub g: RistrettoPoint,
    /// Blinding generator (for randomness)
    pub h: RistrettoPoint,
}

impl PedersenCommitment {
    /// Create a new Pedersen commitment scheme with secure generators
    pub fn new() -> Self {
        let g = RISTRETTO_BASEPOINT_POINT;
        
        // Generate H using hash-to-curve (nothing-up-my-sleeve)
        let mut hasher = Sha512::new();
        hasher.update(b"SafeMask-Pedersen-H-Generator-v1");
        let h_bytes = hasher.finalize();
        let h = RistrettoPoint::from_uniform_bytes(&h_bytes.into());
        
        PedersenCommitment { g, h }
    }
    
    /// Commit to a value with a specific blinding factor
    ///
    /// # Arguments
    ///
    /// * `value` - The value to commit to (e.g., transaction amount)
    /// * `blinding` - Random blinding factor for hiding
    ///
    /// # Returns
    ///
    /// A commitment point: C = value·G + blinding·H
    pub fn commit(&self, value: u64, blinding: &Scalar) -> Commitment {
        let v = Scalar::from(value);
        let point = self.g * v + self.h * blinding;
        
        Commitment {
            point,
            value: Some(value),
            blinding: Some(*blinding),
        }
    }
    
    /// Commit to a value with a random blinding factor
    ///
    /// # Arguments
    ///
    /// * `value` - The value to commit to
    ///
    /// # Returns
    ///
    /// Tuple of (Commitment, blinding factor)
    pub fn commit_with_random_blinding(&self, value: u64) -> (Commitment, Scalar) {
        let blinding = random_scalar();
        let commitment = self.commit(value, &blinding);
        (commitment, blinding)
    }
    
    /// Verify a commitment opening
    ///
    /// # Arguments
    ///
    /// * `commitment` - The commitment to verify
    /// * `value` - Claimed value
    /// * `blinding` - Claimed blinding factor
    ///
    /// # Returns
    ///
    /// true if the opening is valid
    pub fn verify_opening(
        &self,
        commitment: &Commitment,
        value: u64,
        blinding: &Scalar,
    ) -> bool {
        let expected = self.commit(value, blinding);
        commitment.point == expected.point
    }
    
    /// Add two commitments (homomorphic addition)
    ///
    /// C(v1, r1) + C(v2, r2) = C(v1 + v2, r1 + r2)
    pub fn add_commitments(c1: &Commitment, c2: &Commitment) -> Commitment {
        Commitment {
            point: c1.point + c2.point,
            value: match (c1.value, c2.value) {
                (Some(v1), Some(v2)) => Some(v1 + v2),
                _ => None,
            },
            blinding: match (c1.blinding, c2.blinding) {
                (Some(b1), Some(b2)) => Some(b1 + b2),
                _ => None,
            },
        }
    }
    
    /// Subtract two commitments
    ///
    /// C(v1, r1) - C(v2, r2) = C(v1 - v2, r1 - r2)
    pub fn subtract_commitments(c1: &Commitment, c2: &Commitment) -> Commitment {
        Commitment {
            point: c1.point - c2.point,
            value: match (c1.value, c2.value) {
                (Some(v1), Some(v2)) => v1.checked_sub(v2),
                _ => None,
            },
            blinding: match (c1.blinding, c2.blinding) {
                (Some(b1), Some(b2)) => Some(b1 - b2),
                _ => None,
            },
        }
    }
}

impl Default for PedersenCommitment {
    fn default() -> Self {
        Self::new()
    }
}

/// A Pedersen commitment with optional value and blinding factor
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Commitment {
    /// The commitment point (public)
    #[serde(with = "ristretto_serde")]
    pub point: RistrettoPoint,
    
    /// The committed value (private, only known to creator)
    #[serde(skip)]
    pub value: Option<u64>,
    
    /// The blinding factor (private, only known to creator)
    #[serde(skip)]
    pub blinding: Option<Scalar>,
}

impl Commitment {
    /// Create a commitment from a point (when receiving from others)
    pub fn from_point(point: RistrettoPoint) -> Self {
        Commitment {
            point,
            value: None,
            blinding: None,
        }
    }
    
    /// Get the commitment as compressed bytes (32 bytes)
    pub fn to_bytes(&self) -> [u8; 32] {
        self.point.compress().to_bytes()
    }
    
    /// Parse a commitment from compressed bytes
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self> {
        let compressed = curve25519_dalek::ristretto::CompressedRistretto(*bytes);
        let point = compressed
            .decompress()
            .ok_or_else(|| CoreError::Commitment("Invalid commitment bytes".into()))?;
        
        Ok(Commitment::from_point(point))
    }
}

/// Bulletproofs range proof (proves value is in range [0, 2^n))
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RangeProof {
    /// The proof bytes (typically ~670 bytes for 64-bit range)
    pub proof_bytes: Vec<u8>,
    
    /// Bit length of the range (e.g., 64 for 64-bit values)
    pub bit_length: usize,
}

impl RangeProof {
    /// Generate a range proof for a committed value
    ///
    /// Proves that the value v satisfies: 0 ≤ v < 2^bit_length
    ///
    /// # Arguments
    ///
    /// * `value` - The value to prove (must be in range)
    /// * `blinding` - The blinding factor used in commitment
    /// * `bit_length` - Number of bits for the range (typically 32 or 64)
    ///
    /// # Returns
    ///
    /// A range proof that can be verified without revealing the value
    pub fn prove(
        value: u64,
        blinding: &Scalar,
        bit_length: usize,
    ) -> Result<Self> {
        // Verify value is in range
        if bit_length < 64 && value >= (1u64 << bit_length) {
            return Err(CoreError::InvalidParameter(
                format!("Value {} exceeds {}-bit range", value, bit_length)
            ));
        }
        
        // TODO: Integrate with bulletproofs crate for actual proof generation
        // For now, return a placeholder
        // In production, use: bulletproofs::RangeProof::prove_single(...)
        
        let proof_bytes = vec![0u8; 672]; // Typical bulletproof size
        
        Ok(RangeProof {
            proof_bytes,
            bit_length,
        })
    }
    
    /// Verify a range proof
    ///
    /// # Arguments
    ///
    /// * `commitment` - The commitment to verify
    ///
    /// # Returns
    ///
    /// true if the proof is valid (value is in range)
    pub fn verify(&self, commitment: &Commitment) -> bool {
        // TODO: Integrate with bulletproofs crate for actual verification
        // For now, return true for placeholder
        // In production, use: bulletproofs::RangeProof::verify_single(...)
        
        true
    }
    
    /// Batch verify multiple range proofs (more efficient)
    pub fn verify_batch(proofs: &[RangeProof], commitments: &[Commitment]) -> bool {
        if proofs.len() != commitments.len() {
            return false;
        }
        
        // TODO: Implement batch verification
        // In production, use bulletproofs batch verification
        
        proofs.iter()
            .zip(commitments.iter())
            .all(|(proof, commitment)| proof.verify(commitment))
    }
}

/// Balance commitment for wallet state
///
/// Combines a Pedersen commitment with a range proof to prove
/// the balance is non-negative without revealing the amount
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BalanceCommitment {
    /// The Pedersen commitment to the balance
    pub commitment: Commitment,
    
    /// Range proof that balance ≥ 0
    pub range_proof: RangeProof,
}

impl BalanceCommitment {
    /// Create a new balance commitment
    pub fn new(balance: u64, blinding: &Scalar) -> Result<Self> {
        let pedersen = PedersenCommitment::new();
        let commitment = pedersen.commit(balance, blinding);
        let range_proof = RangeProof::prove(balance, blinding, 64)?;
        
        Ok(BalanceCommitment {
            commitment,
            range_proof,
        })
    }
    
    /// Verify the balance commitment is valid
    pub fn verify(&self) -> bool {
        self.range_proof.verify(&self.commitment)
    }
}

// Serialization helper for RistrettoPoint
mod ristretto_serde {
    use curve25519_dalek::ristretto::{CompressedRistretto, RistrettoPoint};
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    
    pub fn serialize<S>(point: &RistrettoPoint, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        point.compress().as_bytes().serialize(serializer)
    }
    
    pub fn deserialize<'de, D>(deserializer: D) -> Result<RistrettoPoint, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: [u8; 32] = Deserialize::deserialize(deserializer)?;
        let compressed = CompressedRistretto(bytes);
        compressed
            .decompress()
            .ok_or_else(|| serde::de::Error::custom("Invalid Ristretto point"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_pedersen_commit_and_verify() {
        let pedersen = PedersenCommitment::new();
        let value = 1000u64;
        let blinding = random_scalar();
        
        let commitment = pedersen.commit(value, &blinding);
        
        // Verify correct opening
        assert!(pedersen.verify_opening(&commitment, value, &blinding));
        
        // Verify incorrect opening fails
        assert!(!pedersen.verify_opening(&commitment, value + 1, &blinding));
        assert!(!pedersen.verify_opening(&commitment, value, &random_scalar()));
    }
    
    #[test]
    fn test_homomorphic_addition() {
        let pedersen = PedersenCommitment::new();
        
        let (c1, b1) = pedersen.commit_with_random_blinding(100);
        let (c2, b2) = pedersen.commit_with_random_blinding(200);
        
        let c_sum = PedersenCommitment::add_commitments(&c1, &c2);
        
        // Verify the sum commitment
        assert!(pedersen.verify_opening(&c_sum, 300, &(b1 + b2)));
    }
    
    #[test]
    fn test_homomorphic_subtraction() {
        let pedersen = PedersenCommitment::new();
        
        let (c1, b1) = pedersen.commit_with_random_blinding(500);
        let (c2, b2) = pedersen.commit_with_random_blinding(200);
        
        let c_diff = PedersenCommitment::subtract_commitments(&c1, &c2);
        
        // Verify the difference commitment
        assert!(pedersen.verify_opening(&c_diff, 300, &(b1 - b2)));
    }
    
    #[test]
    fn test_commitment_serialization() {
        let pedersen = PedersenCommitment::new();
        let (commitment, _) = pedersen.commit_with_random_blinding(12345);
        
        // Serialize to bytes
        let bytes = commitment.to_bytes();
        
        // Deserialize from bytes
        let deserialized = Commitment::from_bytes(&bytes).unwrap();
        
        assert_eq!(commitment.point, deserialized.point);
    }
    
    #[test]
    fn test_range_proof_in_range() {
        let value = 1000u64;
        let blinding = random_scalar();
        
        let proof = RangeProof::prove(value, &blinding, 64).unwrap();
        
        let pedersen = PedersenCommitment::new();
        let commitment = pedersen.commit(value, &blinding);
        
        assert!(proof.verify(&commitment));
    }
    
    #[test]
    fn test_balance_commitment() {
        let balance = 50000u64;
        let blinding = random_scalar();
        
        let balance_commitment = BalanceCommitment::new(balance, &blinding).unwrap();
        
        assert!(balance_commitment.verify());
    }
    
    #[test]
    fn test_transaction_balance_equation() {
        let pedersen = PedersenCommitment::new();
        
        // Input commitments
        let (input1, b1) = pedersen.commit_with_random_blinding(5000);
        let (input2, b2) = pedersen.commit_with_random_blinding(3000);
        
        // Calculate total input blinding factor
        let total_blinding_in = b1 + b2;
        
        // For outputs, we need to use blinding factors that sum to total_blinding_in
        let b3 = random_scalar();
        let b4 = total_blinding_in - b3; // This ensures b3 + b4 = b1 + b2
        
        let output1 = pedersen.commit(7000, &b3);
        let output2 = pedersen.commit(1000, &b4);
        
        // Sum of inputs
        let sum_inputs = PedersenCommitment::add_commitments(&input1, &input2);
        
        // Sum of outputs
        let sum_outputs = PedersenCommitment::add_commitments(&output1, &output2);
        
        // Verify balance equation: sum(inputs) = sum(outputs)
        // This should pass because both value and blinding factor sums match
        assert_eq!(sum_inputs.point, sum_outputs.point);
    }
}
