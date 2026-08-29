
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

declare_id!("5B7Vf6h3MikSQNWpHtyMu5UNMA233MboaMGK837gxhph");

#[program]
pub mod attendance_ledger {
    use super::*;

    /// Store a new attendance record hash
    pub fn record_attendance(
        ctx: Context<RecordAttendance>,
        record_id: String,
        hash_value: [u8; 32],
        timestamp: i64,
        device_id: String,
    ) -> Result<()> {
        let record = &mut ctx.accounts.record;

        record.record_id = record_id;
        record.hash = hash_value;
        record.timestamp = timestamp;
        record.device_id = device_id;
        record.bump = ctx.bumps.record;

        Ok(())
    }

    /// Verify attendance record integrity
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
    pub const SPACE: usize =
        8 +       // Anchor account discriminator
        4 + 64 +  // record_id
        32 +      // hash
        8 +       // timestamp
        4 + 32 +  // device_id
        1;        // bump
}
