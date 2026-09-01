use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

declare_id!("5B7Vf6h3MikSQNWpHtyMu5UNMA233MboaMGK837gxhph");

#[program]
pub mod attendance_ledger {
    use super::*;
    pub fn record_attendance(
        ctx: Context<RecordAttendance>,
        record_id: String,
        hash_value: [u8; 32],
        timestamp: i64,
        device_id: String,
    ) -> Result<()> {

        require!(
            record_id.as_bytes().len() <= AttendanceRecord::MAX_RECORD_ID_LENGTH,
            AttendanceError::RecordIdTooLong
        );

        require!(
            device_id.as_bytes().len() <= AttendanceRecord::MAX_DEVICE_ID_LENGTH,
            AttendanceError::DeviceIdTooLong
        );

       
        require!(
            timestamp > 0,
            AttendanceError::InvalidTimestamp
        );


        let record = &mut ctx.accounts.record;

        record.record_id = record_id;
        record.hash = hash_value;
        record.timestamp = timestamp;
        record.device_id = device_id;
        record.bump = ctx.bumps.record;

        Ok(())
    }

    /
    pub fn verify_integrity(
        ctx: Context<VerifyIntegrity>,
        provided_hash: [u8; 32],
    ) -> Result<bool> {
        let record = &ctx.accounts.record;

        Ok(record.hash == provided_hash)
    }
}

#[derive(Accounts)]
#[instruction(record_id: String)]
pub struct RecordAttendance<'info> {
    #[account(
        init,
        payer = authority,
        space = AttendanceRecord::SPACE,
        seeds = [
            b"attendance",
            hash(record_id.as_bytes()).to_bytes().as_ref()
        ],
        bump
    )]
    pub record: Account<'info, AttendanceRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyIntegrity<'info> {
    pub record: Account<'info, AttendanceRecord>,
}

#[account]
pub struct AttendanceRecord {
    
    pub record_id: String,

    pub hash: [u8; 32],

    pub timestamp: i64,

    pub device_id: String,

    pub bump: u8,
}


impl AttendanceRecord {
    pub const MAX_RECORD_ID_LENGTH: usize = 256;

    /// Maximum device ID length.
    pub const MAX_DEVICE_ID_LENGTH: usize = 128;

    pub const SPACE: usize =
        8 +                       // Anchor discriminator
        4 + Self::MAX_RECORD_ID_LENGTH + // record_id
        32 +                      // hash
        8 +                       // timestamp
        4 + Self::MAX_DEVICE_ID_LENGTH + // device_id
        1;                        // bump
}

#[error_code]
pub enum AttendanceError {
    #[msg("The record ID is too long.")]
    RecordIdTooLong,

    #[msg("The device ID is too long.")]
    DeviceIdTooLong,

    #[msg("The attendance timestamp is invalid.")]
    InvalidTimestamp,
}